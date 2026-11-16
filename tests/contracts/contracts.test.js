/**
 * @jest-environment node
 */
/*
 * Contract tests (T-04): validate contracts/fixtures/* theo JSON Schema trong contracts/.
 *   - Tự phát hiện contracts/*.schema.json, contracts/openapi.yaml, contracts/fixtures/*.json;
 *     thiếu file nào thì skip phần tương ứng (có lý do).
 *   - Mỗi fixture phải được khai báo trong tests/contracts/fixture-map.json.
 *   - Fixture không được chứa secret thật (private key PEM, JWT, refresh token...).
 *   - OpenAPI phủ đủ endpoint ở plan §6, mọi operation có auth policy + x-rate-limit.
 * Ajv 2020-12 từ devDependency `ajv@^8` + `ajv-formats@^3` (root).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACTS = path.join(ROOT, 'contracts');
const FIXTURES = path.join(CONTRACTS, 'fixtures');
const MAP = require('./fixture-map.json');
const EXPECTED = require('./expected-endpoints.json');

const exists = (p) => fs.existsSync(p);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const loadAjv2020 = () => {
  try {
    const mod = require('ajv/dist/2020'); // ajv@^8 devDependency trực tiếp
    return mod.default || mod;
  } catch (e) {
    return null;
  }
};

const loadYaml = () => {
  try {
    return require('yaml');
  } catch (e) {
    return null;
  }
};

const Ajv2020 = loadAjv2020();
const YAML = loadYaml();
const OPENAPI_PATH = path.join(CONTRACTS, 'openapi.yaml');
const E2EE_PATH = path.join(CONTRACTS, 'e2ee-envelope.schema.json');
const SOCKET_PATH = path.join(CONTRACTS, 'socket-events.schema.json');
const OPENAPI_ID = 'https://whisperchat.lan/contracts/openapi.yaml';

const fixtureFiles = exists(FIXTURES)
  ? fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json')).sort()
  : [];
const openapi = exists(OPENAPI_PATH) && YAML ? YAML.parse(fs.readFileSync(OPENAPI_PATH, 'utf8')) : null;

const buildAjv = () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  try {
    require('ajv-formats')(ajv);
  } catch (e) {
    /* formats optional */
  }
  const ids = {};
  if (exists(E2EE_PATH)) {
    const s = readJson(E2EE_PATH);
    ajv.addSchema(s);
    ids.e2ee = s.$id;
  }
  if (exists(SOCKET_PATH)) {
    const s = readJson(SOCKET_PATH);
    ajv.addSchema(s);
    ids.socket = s.$id;
  }
  if (openapi) {
    ajv.addSchema({ ...openapi, $id: OPENAPI_ID });
    ids.openapi = OPENAPI_ID;
  }
  return { ajv, ids };
};

const resolveRef = (ids, ref) => {
  const [alias, pointer] = ref.split('#');
  if (!ids[alias]) return null;
  return `${ids[alias]}#${pointer}`;
};

const haveSchemas = Ajv2020 && (exists(E2EE_PATH) || openapi);
const describeIf = (cond) => (cond ? describe : describe.skip);

describeIf(fixtureFiles.length > 0)('contract fixtures: inventory and hygiene', () => {
  it('every fixture is declared in tests/contracts/fixture-map.json', () => {
    const unmapped = fixtureFiles.filter((f) => !MAP.fixtures[f]);
    expect(unmapped).toEqual([]);
  });

  it('fixture-map has no stale entries', () => {
    const stale = Object.keys(MAP.fixtures).filter((f) => !fixtureFiles.includes(f));
    expect(stale).toEqual([]);
  });

  const SECRET_PATTERNS = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PEM private key'],
    [/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/, 'JWT'],
    [/"(privateKey|secretKey|seed|refreshToken|accessToken|jwt|apiKey|serviceAccount)"\s*:/i, 'secret-bearing field'],
    [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
    [/@(?!example\.invalid")[A-Za-z0-9.-]+\.(com|net|org|vn|io)"/, 'non-reserved email domain'],
  ];

  test.each(fixtureFiles)('%s contains no secret material', (file) => {
    const text = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
    const hits = SECRET_PATTERNS.filter(([re]) => re.test(text)).map(([, name]) => name);
    expect(hits).toEqual([]);
  });

  test.each(fixtureFiles)('%s is strict JSON without duplicate keys', (file) => {
    const text = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
    // Duplicate keys: so sánh số key thô với số key sau parse ở mỗi object literal đơn giản.
    const parsed = JSON.parse(text);
    const countKeys = (v) =>
      v && typeof v === 'object'
        ? (Array.isArray(v) ? 0 : Object.keys(v).length) + Object.values(v).reduce((n, c) => n + countKeys(c), 0)
        : 0;
    const rawKeyCount = (text.match(/"(?:[^"\\]|\\.)*"\s*:/g) || []).length;
    expect(rawKeyCount).toBe(countKeys(parsed));
  });
});

describeIf(fixtureFiles.length > 0 && haveSchemas)('contract fixtures: JSON Schema validation', () => {
  const { ajv, ids } = haveSchemas ? buildAjv() : { ajv: null, ids: {} };
  const schemaChecked = fixtureFiles.filter((f) => MAP.fixtures[f] && MAP.fixtures[f].schemaValid !== null);

  test.each(schemaChecked)('%s', (file) => {
    const entry = MAP.fixtures[file];
    const ref = resolveRef(ids, entry.schema);
    expect(ref).not.toBeNull();
    const validate = ajv.getSchema(ref);
    expect(validate).toBeDefined();
    const ok = validate(readJson(path.join(FIXTURES, file)));
    if (ok !== entry.schemaValid) {
      // Hiện lỗi ajv để dễ debug khi fixture/schema lệch.
      throw new Error(`${file}: expected schemaValid=${entry.schemaValid}, got ${ok}\n${JSON.stringify(validate.errors, null, 2)}`);
    }
  });

  it('policy-only fixtures are listed for server tests (T-09/T-15)', () => {
    const policy = fixtureFiles.filter((f) => MAP.fixtures[f] && MAP.fixtures[f].policyReject);
    expect(policy.length).toBeGreaterThan(0);
  });
});

describeIf(Boolean(Ajv2020) && exists(SOCKET_PATH))('socket-events schema', () => {
  it('compiles under JSON Schema 2020-12', () => {
    const { ajv, ids } = buildAjv();
    expect(ajv.getSchema(ids.socket)).toBeDefined();
  });
});

describeIf(Boolean(openapi))('openapi.yaml coverage vs plan §6', () => {
  const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
  const norm = (p) => p.replace(/\{[^}]+\}/g, '{id}');
  const operations = openapi
    ? Object.entries(openapi.paths || {}).flatMap(([p, item]) =>
        METHODS.filter((m) => item[m]).map((m) => ({ key: `${m.toUpperCase()} ${norm(p)}`, op: item[m] }))
      )
    : [];
  const keys = new Set(operations.map((o) => o.key));

  it('declares OpenAPI 3.1', () => {
    expect(String(openapi.openapi)).toMatch(/^3\.1\./);
  });

  test.each(EXPECTED.endpoints)('has %s', (endpoint) => {
    expect(keys.has(endpoint)).toBe(true);
  });

  it('every operation declares x-rate-limit', () => {
    const missing = operations.filter((o) => !o.op['x-rate-limit']).map((o) => o.key);
    expect(missing).toEqual([]);
  });

  it('only public auth/health (and enrollment with its own token) opt out of bearer auth', () => {
    const allowed = new Set([...EXPECTED.publicEndpoints, 'POST /devices/enroll']);
    const optedOut = operations
      .filter((o) => Array.isArray(o.op.security) && o.op.security.length === 0)
      .map((o) => o.key);
    expect(optedOut.filter((k) => !allowed.has(k))).toEqual([]);
    expect(Array.isArray(openapi.security) && openapi.security.length > 0).toBe(true);
  });

  it('admin endpoints are not public', () => {
    const adminPublic = operations.filter(
      (o) => o.key.includes('/admin/') && Array.isArray(o.op.security) && o.op.security.length === 0
    );
    expect(adminPublic).toEqual([]);
  });
});

if (!Ajv2020 || !YAML || fixtureFiles.length === 0) {
  describe.skip(`contracts: partially skipped (ajv2020=${Boolean(Ajv2020)}, yaml=${Boolean(YAML)}, fixtures=${fixtureFiles.length})`, () => {
    it('placeholder', () => {});
  });
}
