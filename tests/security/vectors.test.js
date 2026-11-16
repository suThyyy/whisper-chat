/**
 * @jest-environment node
 */
/*
 * Chạy các known-answer vectors trong tests/security/vectors/*.json qua từng "provider":
 *   - node:   node:crypto (OpenSSL) — luôn chạy, chứng minh bản thân file vector đúng.
 *   - noble:  @noble/curves, @noble/hashes, @noble/ciphers — thư viện protocol sẽ dùng
 *             (plan §5). Tự skip nếu chưa cài (dependency đã xin lead).
 *   - product: src/security/* của Codex (T-12) — thêm adapter khi API chốt.
 * Negative cases (negative-cases.json) phải bị reject ở mọi provider.
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const { canonicalize } = require('./vectors/jcs-reference');

const VECTOR_DIR = path.join(__dirname, 'vectors');
const load = (name) => JSON.parse(fs.readFileSync(path.join(VECTOR_DIR, name), 'utf8'));

const X25519 = load('x25519.rfc7748.json');
const ED25519 = load('ed25519.rfc8032.json');
const HKDF = load('hkdf-sha256.rfc5869.json');
const GCM = load('aes-256-gcm.mcgrew-viega.json');
const SHA256 = load('sha256.fips180.json');
const JCS = load('jcs.rfc8785.json');
const NEG = load('negative-cases.json');

const hex = (s) => Buffer.from(s, 'hex');
const toHex = (b) => Buffer.from(b).toString('hex');
const isAllZero = (b) => Buffer.from(b).every((x) => x === 0);

// ---------------------------------------------------------------- providers
const nodeProvider = () => {
  const X25519_PKCS8 = hex('302e020100300506032b656e04220420');
  const X25519_SPKI = hex('302a300506032b656e032100');
  const ED25519_PKCS8 = hex('302e020100300506032b657004220420');
  const ED25519_SPKI = hex('302a300506032b6570032100');
  const priv = (prefix, raw) =>
    crypto.createPrivateKey({ key: Buffer.concat([prefix, raw]), format: 'der', type: 'pkcs8' });
  const pub = (prefix, raw) =>
    crypto.createPublicKey({ key: Buffer.concat([prefix, raw]), format: 'der', type: 'spki' });

  return {
    x25519: (scalar, u) =>
      crypto.diffieHellman({ privateKey: priv(X25519_PKCS8, scalar), publicKey: pub(X25519_SPKI, u) }),
    ed25519PublicKey: (seed) =>
      crypto.createPublicKey(priv(ED25519_PKCS8, seed)).export({ format: 'der', type: 'spki' }).subarray(12),
    ed25519Sign: (msg, seed) => crypto.sign(null, msg, priv(ED25519_PKCS8, seed)),
    ed25519Verify: (sig, msg, pk) => crypto.verify(null, msg, pub(ED25519_SPKI, pk), sig),
    hkdfSha256: (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len)),
    hkdfExtract: (ikm, salt) =>
      crypto.createHmac('sha256', salt.length ? salt : Buffer.alloc(32)).update(ikm).digest(),
    sha256: (msg) => crypto.createHash('sha256').update(msg).digest(),
    gcmEncrypt: (key, iv, pt, aad) => {
      const c = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
      c.setAAD(aad);
      const ct = Buffer.concat([c.update(pt), c.final()]);
      return { ciphertext: ct, tag: c.getAuthTag() };
    },
    gcmDecrypt: (key, iv, ct, tag, aad) => {
      if (tag.length !== 16) throw new Error('tag must be 16 bytes');
      const d = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
      d.setAAD(aad);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]);
    },
  };
};

const tryRequire = (...ids) => {
  for (const id of ids) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(id);
    } catch (e) {
      /* try next */
    }
  }
  return null;
};

const nobleProvider = () => {
  const curves = tryRequire('@noble/curves/ed25519', '@noble/curves/ed25519.js');
  const hkdfMod = tryRequire('@noble/hashes/hkdf', '@noble/hashes/hkdf.js');
  const shaMod = tryRequire('@noble/hashes/sha2', '@noble/hashes/sha2.js', '@noble/hashes/sha256');
  const aesMod = tryRequire('@noble/ciphers/aes', '@noble/ciphers/aes.js');
  if (!curves || !hkdfMod || !shaMod || !aesMod) return null;
  const { x25519, ed25519 } = curves;
  const { sha256 } = shaMod;
  const { gcm } = aesMod;
  return {
    x25519: (scalar, u) => x25519.scalarMult(scalar, u),
    ed25519PublicKey: (seed) => ed25519.getPublicKey(seed),
    ed25519Sign: (msg, seed) => ed25519.sign(msg, seed),
    ed25519Verify: (sig, msg, pk) => {
      try {
        return ed25519.verify(sig, msg, pk);
      } catch (e) {
        return false;
      }
    },
    hkdfSha256: (ikm, salt, info, len) => hkdfMod.hkdf(sha256, ikm, salt, info, len),
    hkdfExtract: (ikm, salt) => hkdfMod.extract(sha256, ikm, salt),
    sha256: (msg) => sha256(msg),
    gcmEncrypt: (key, iv, pt, aad) => {
      const out = gcm(key, iv, aad).encrypt(pt);
      return { ciphertext: out.subarray(0, out.length - 16), tag: out.subarray(out.length - 16) };
    },
    gcmDecrypt: (key, iv, ct, tag, aad) => {
      if (tag.length !== 16) throw new Error('tag must be 16 bytes');
      return gcm(key, iv, aad).decrypt(Buffer.concat([ct, tag]));
    },
  };
};

// ---------------------------------------------------------------- mutations
const mutate = (bytes, m) => {
  const b = Buffer.from(bytes);
  if (m.op === 'flipBit') {
    if (b.length === 0) throw new Error(`cannot flip bit of empty field ${m.field}`);
    b[m.byte] ^= 1 << m.bit;
    return b;
  }
  if (m.op === 'truncate') return b.subarray(0, m.length);
  if (m.op === 'replace') return hex(m.value);
  throw new Error(`unknown op ${m.op}`);
};

// ---------------------------------------------------------------- suites
const runSuite = (label, provider) => {
  describe(`${label}: RFC 7748 X25519`, () => {
    test.each(X25519.functionVectors)('$id', (v) => {
      expect(toHex(provider.x25519(hex(v.scalar), hex(v.u)))).toBe(v.output);
    });

    it(`${X25519.iterated.id} (1 and 1000 iterations)`, () => {
      let k = hex(X25519.iterated.start);
      let u = hex(X25519.iterated.start);
      for (let i = 1; i <= 1000; i += 1) {
        const next = Buffer.from(provider.x25519(k, u));
        u = k;
        k = next;
        if (i === 1) expect(toHex(k)).toBe(X25519.iterated.after1);
      }
      expect(toHex(k)).toBe(X25519.iterated.after1000);
    });

    it(X25519.diffieHellman.id, () => {
      const dh = X25519.diffieHellman;
      const base = hex(`09${'00'.repeat(31)}`);
      expect(toHex(provider.x25519(hex(dh.alicePrivate), base))).toBe(dh.alicePublic);
      expect(toHex(provider.x25519(hex(dh.bobPrivate), base))).toBe(dh.bobPublic);
      expect(toHex(provider.x25519(hex(dh.alicePrivate), hex(dh.bobPublic)))).toBe(dh.shared);
      expect(toHex(provider.x25519(hex(dh.bobPrivate), hex(dh.alicePublic)))).toBe(dh.shared);
    });
  });

  describe(`${label}: RFC 8032 Ed25519`, () => {
    test.each(ED25519.vectors)('$id', (v) => {
      expect(toHex(provider.ed25519PublicKey(hex(v.secretKey)))).toBe(v.publicKey);
      expect(toHex(provider.ed25519Sign(hex(v.message), hex(v.secretKey)))).toBe(v.signature);
      expect(provider.ed25519Verify(hex(v.signature), hex(v.message), hex(v.publicKey))).toBe(true);
    });
  });

  describe(`${label}: RFC 5869 HKDF-SHA256`, () => {
    test.each(HKDF.vectors)('$id', (v) => {
      expect(toHex(provider.hkdfExtract(hex(v.ikm), hex(v.salt)))).toBe(v.prk);
      expect(toHex(provider.hkdfSha256(hex(v.ikm), hex(v.salt), hex(v.info), v.length))).toBe(v.okm);
    });
  });

  describe(`${label}: AES-256-GCM`, () => {
    test.each(GCM.vectors)('$id', (v) => {
      const { ciphertext, tag } = provider.gcmEncrypt(hex(v.key), hex(v.iv), hex(v.plaintext), hex(v.aad));
      expect(toHex(ciphertext)).toBe(v.ciphertext);
      expect(toHex(tag)).toBe(v.tag);
      const pt = provider.gcmDecrypt(hex(v.key), hex(v.iv), hex(v.ciphertext), hex(v.tag), hex(v.aad));
      expect(toHex(pt)).toBe(v.plaintext);
    });
  });

  describe(`${label}: SHA-256`, () => {
    test.each(SHA256.vectors)('$id', (v) => {
      expect(toHex(provider.sha256(Buffer.from(v.messageUtf8, 'utf8')))).toBe(v.digest);
    });
  });

  describe(`${label}: negative cases (must reject)`, () => {
    const gcmBase = GCM.vectors.find((v) => v.id === NEG.aesGcm.baseVector);
    test.each(NEG.aesGcm.mutations)('$id', (m) => {
      const f = { ...gcmBase };
      const fields = ['key', 'iv', 'aad', 'ciphertext', 'tag'];
      const args = Object.fromEntries(fields.map((k) => [k, hex(f[k])]));
      args[m.field] = mutate(args[m.field], m);
      expect(() => provider.gcmDecrypt(args.key, args.iv, args.ciphertext, args.tag, args.aad)).toThrow();
    });

    const edBase = ED25519.vectors.find((v) => v.id === NEG.ed25519.baseVector);
    test.each(NEG.ed25519.mutations)('$id', (m) => {
      const args = {
        signature: hex(edBase.signature),
        message: hex(edBase.message),
        publicKey: hex(edBase.publicKey),
      };
      if (m.op === 'replaceFromVector') {
        args[m.field] = hex(ED25519.vectors.find((v) => v.id === m.vector)[m.field]);
      } else {
        args[m.field] = mutate(args[m.field], m);
      }
      let ok;
      try {
        ok = provider.ed25519Verify(args.signature, args.message, args.publicKey);
      } catch (e) {
        ok = false;
      }
      expect(ok).toBe(false);
    });

    test.each(NEG.x25519LowOrderPublicKeys.points)('x25519 low-order $id → throw or all-zero', (p) => {
      let shared;
      try {
        shared = provider.x25519(hex(X25519.diffieHellman.alicePrivate), hex(p.u));
      } catch (e) {
        return; // rejected by the library: acceptable
      }
      expect(isAllZero(shared)).toBe(true); // protocol layer must then reject (plan §5)
    });
  });
};

describe('vector files', () => {
  test.each([
    ['x25519.rfc7748.json', X25519],
    ['ed25519.rfc8032.json', ED25519],
    ['hkdf-sha256.rfc5869.json', HKDF],
    ['aes-256-gcm.mcgrew-viega.json', GCM],
    ['sha256.fips180.json', SHA256],
    ['jcs.rfc8785.json', JCS],
    ['negative-cases.json', NEG],
  ])('%s declares an official source URL', (_name, file) => {
    expect(Array.isArray(file.source)).toBe(true);
    file.source.forEach((s) => expect(s).toMatch(/^https:\/\//));
  });

  it('AES-256-GCM set has >=4 cases incl. AAD and non-empty tag', () => {
    expect(GCM.vectors.length).toBeGreaterThanOrEqual(4);
    expect(GCM.vectors.some((v) => v.aad.length > 0)).toBe(true);
    GCM.vectors.forEach((v) => expect(v.tag).toHaveLength(32));
  });
});

describe('RFC 8785 JCS (reference oracle)', () => {
  test.each(JCS.canonicalization)('$id', (v) => {
    const out = canonicalize(JSON.parse(v.inputJson));
    expect(out).toBe(v.expectedText);
    expect(Buffer.from(out, 'utf8').toString('hex')).toBe(v.expectedUtf8Hex);
  });

  test.each(JCS.propertySorting)('$id', (v) => {
    // Không JSON.parse lại: JS object luôn đưa key dạng số ("1") lên đầu.
    const out = canonicalize(JSON.parse(v.inputJson));
    const valuesInOrder = [...out.matchAll(/":"([^"]*)"/g)].map((m) => m[1]);
    expect(valuesInOrder).toEqual(v.expectedValueOrder);
  });

  test.each(JCS.numberSamples)('number $ieee754 → $json', (s) => {
    expect(canonicalize(hex(s.ieee754).readDoubleBE(0))).toBe(s.json);
  });

  test.each(JCS.mustReject)('$id', (r) => {
    const value = r.ieee754 ? hex(r.ieee754).readDoubleBE(0) : JSON.parse(r.inputJson);
    expect(() => canonicalize(value)).toThrow();
  });
});

runSuite('node:crypto', nodeProvider());

const noble = nobleProvider();
if (noble) {
  runSuite('@noble', noble);
} else {
  // Chưa có @noble/* trong devDependencies (đã xin lead qua orchestration ask).
  // Khi cài xong, block này tự chạy; không cần sửa test.
  describe.skip('@noble (not installed: @noble/curves @noble/hashes @noble/ciphers)', () => {
    it('placeholder', () => {});
  });
}

// TODO(T-12/T-15): thêm provider 'product' gọi src/security/* của Codex khi API chốt,
// và golden envelope wc-e2ee-v1 (AAD, wrap info với NUL byte) chạy trên cả Node và Hermes.
