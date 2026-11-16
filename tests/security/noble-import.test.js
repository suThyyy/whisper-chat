import { sha256 } from '@noble/hashes/sha2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { gcm } from '@noble/ciphers/aes.js';

describe('@noble packages ESM import in Jest', () => {
  it('imports @noble/hashes, @noble/curves, and @noble/ciphers successfully', () => {
    expect(typeof sha256).toBe('function');
    expect(typeof ed25519.getPublicKey).toBe('function');
    expect(typeof gcm).toBe('function');
  });
});
