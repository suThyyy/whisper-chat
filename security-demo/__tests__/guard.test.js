/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const { enforceGuard, GuardError, redact } = require('../lib/guard');

const ok = ['--demo-only', '--base-url=https://whisperchat.lan:8443/v1'];
const env = {};

describe('attack kit guard', () => {
  it('refuses without --demo-only', () => {
    expect(() => enforceGuard({ argv: ok.slice(1), env })).toThrow(GuardError);
  });

  it('refuses hosts outside the allowlist', () => {
    expect(() =>
      enforceGuard({ argv: ['--demo-only', '--base-url=https://prod.example.com/v1'], env })
    ).toThrow(/allowlist/);
  });

  it('refuses plain http', () => {
    expect(() => enforceGuard({ argv: ['--demo-only', '--base-url=http://localhost/v1'], env })).toThrow(
      /HTTPS/
    );
  });

  it('requires matching --confirm-db for destructive scenarios', () => {
    expect(() => enforceGuard({ argv: ok, env, destructive: true })).toThrow(/Destructive/);
    expect(() =>
      enforceGuard({ argv: [...ok, '--confirm-db=other'], env: { WC_DEMO_DATABASE_ID: 'lab-1' }, destructive: true })
    ).toThrow(/Destructive/);
    expect(
      enforceGuard({ argv: [...ok, '--confirm-db=lab-1'], env: { WC_DEMO_DATABASE_ID: 'lab-1' }, destructive: true })
        .baseUrl.hostname
    ).toBe('whisperchat.lan');
  });

  it('honours WC_DEMO_ALLOWED_HOSTS', () => {
    const ctx = enforceGuard({
      argv: ['--demo-only', '--base-url=https://demo.local/v1'],
      env: { WC_DEMO_ALLOWED_HOSTS: 'demo.local' },
    });
    expect(ctx.baseUrl.hostname).toBe('demo.local');
  });

  it('redacts tokens and passwords', () => {
    const out = redact({
      password: 'Correct-Horse',
      refreshToken: 'abc',
      header: 'Bearer eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.sig',
    });
    expect(out).not.toMatch(/Correct-Horse|"abc"|eyJhbGci/);
  });
});

describe('attack kit layout', () => {
  const dirs = ['a-bruteforce', 'b-idor', 'c-tamper', 'd-replay', 'e-refresh-reuse', 'f-mitm-pinning', 'g-at-rest'];

  test.each(dirs)('%s has README with expected/assertion/MASVS and a guarded run.js', (dir) => {
    const base = path.join(__dirname, '..', dir);
    const readme = fs.readFileSync(path.join(base, 'README.md'), 'utf8');
    expect(readme).toMatch(/## Expected result/);
    expect(readme).toMatch(/## Machine assertions/);
    expect(readme).toMatch(/MASVS/);
    const { meta } = require(path.join(base, 'run.js'));
    expect(meta.steps.length).toBeGreaterThan(0);
  });

  it('kit contains no secret material', () => {
    const walk = (d) =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
      );
    const files = walk(path.join(__dirname, '..')).filter((f) => !f.includes('__tests__'));
    const hits = files.filter((f) =>
      /-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.eyJ|AIza[0-9A-Za-z_-]{35}/.test(fs.readFileSync(f, 'utf8'))
    );
    expect(hits).toEqual([]);
  });
});
