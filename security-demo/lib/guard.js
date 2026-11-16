/*
 * Guard chung cho attack kit (plan §8): chỉ chạy trên host demo trong allowlist,
 * bắt buộc `--demo-only`; kịch bản destructive cần thêm `--confirm-db=<databaseId>`
 * khớp WC_DEMO_DATABASE_ID. Không đọc/ghi secret; mọi output đi qua redact().
 */
const DEFAULT_ALLOWED_HOSTS = ['whisperchat.lan', 'localhost', '127.0.0.1'];

class GuardError extends Error {}

const parseArgs = (argv) => {
  const args = { flags: new Set(), values: {} };
  argv.forEach((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) return;
    if (m[2] === undefined) args.flags.add(m[1]);
    else args.values[m[1]] = m[2];
  });
  return args;
};

const allowedHosts = (env) =>
  (env.WC_DEMO_ALLOWED_HOSTS ? env.WC_DEMO_ALLOWED_HOSTS.split(',') : DEFAULT_ALLOWED_HOSTS)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

/**
 * @returns {{baseUrl: URL, dryRun: boolean, args}} or throws GuardError
 */
const enforceGuard = ({ argv = process.argv.slice(2), env = process.env, destructive = false } = {}) => {
  const args = parseArgs(argv);
  if (!args.flags.has('demo-only')) {
    throw new GuardError('Refusing to run: pass --demo-only (attack kit is for the demo lab only).');
  }
  const raw = args.values['base-url'] || env.WC_DEMO_BASE_URL;
  if (!raw) throw new GuardError('Missing --base-url=https://<demo-host>:<port>/v1 or WC_DEMO_BASE_URL.');
  let baseUrl;
  try {
    baseUrl = new URL(raw);
  } catch (e) {
    throw new GuardError(`Invalid base URL: ${raw}`);
  }
  if (baseUrl.protocol !== 'https:') {
    throw new GuardError('Refusing non-HTTPS base URL (plan S3: no cleartext).');
  }
  const hosts = allowedHosts(env);
  if (!hosts.includes(baseUrl.hostname.toLowerCase())) {
    throw new GuardError(`Host ${baseUrl.hostname} is not in allowlist [${hosts.join(', ')}].`);
  }
  if (destructive) {
    const expected = env.WC_DEMO_DATABASE_ID;
    const confirm = args.values['confirm-db'];
    if (!expected || !confirm || confirm !== expected) {
      throw new GuardError(
        'Destructive scenario: set WC_DEMO_DATABASE_ID and pass matching --confirm-db=<id>.'
      );
    }
  }
  return { baseUrl, dryRun: args.flags.has('dry-run'), args };
};

const REDACTIONS = [
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]'],
  [/("?(password|refreshToken|accessToken|token|privateKey|secret)"?\s*[:=]\s*)"[^"]*"/gi, '$1"[REDACTED]"'],
  [/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]'],
];

const redact = (value) => {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  REDACTIONS.forEach(([re, rep]) => {
    text = text.replace(re, rep);
  });
  return text;
};

/** Run a scenario main() with guard + uniform exit codes: 0 pass, 1 assertion fail, 2 guard/setup, 3 not implemented. */
const runScenario = async (meta, main, { destructive = false } = {}) => {
  let ctx;
  try {
    ctx = enforceGuard({ destructive });
  } catch (e) {
    if (e instanceof GuardError) {
      console.error(`[${meta.id}] GUARD: ${e.message}`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }
  console.log(`[${meta.id}] ${meta.title} → ${ctx.baseUrl.origin}${ctx.dryRun ? ' (dry-run)' : ''}`);
  if (ctx.dryRun) {
    meta.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    return;
  }
  try {
    const result = await main(ctx);
    console.log(redact({ scenario: meta.id, ...result }));
    process.exitCode = result && result.pass ? 0 : 1;
  } catch (e) {
    if (e && e.code === 'NOT_IMPLEMENTED') {
      console.error(`[${meta.id}] NOT IMPLEMENTED: ${e.message}`);
      process.exitCode = 3;
      return;
    }
    console.error(`[${meta.id}] ERROR: ${redact(String(e && e.message))}`);
    process.exitCode = 1;
  }
};

const notImplemented = (what) => {
  const e = new Error(what);
  e.code = 'NOT_IMPLEMENTED';
  return e;
};

module.exports = { enforceGuard, GuardError, parseArgs, redact, runScenario, notImplemented, DEFAULT_ALLOWED_HOSTS };
