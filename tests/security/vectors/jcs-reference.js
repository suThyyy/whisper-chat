/*
 * Test-oracle JCS (RFC 8785) canonicalizer, port of RFC 8785 Appendix A.
 * Chỉ dùng để tự kiểm vector file là đúng; KHÔNG phải implementation sản phẩm
 * (implementation thật thuộc src/security/* của Codex, T-12).
 */
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

const canonicalize = (value) => {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS: non-finite number');
    return JSON.stringify(value); // ECMAScript Number::toString, -0 -> "0"
  }
  if (typeof value === 'string') {
    if (LONE_SURROGATE.test(value)) throw new Error('JCS: lone surrogate');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    // Default JS sort compares UTF-16 code units, as required by RFC 8785 3.2.3.
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((k) => {
        if (LONE_SURROGATE.test(k)) throw new Error('JCS: lone surrogate');
        return `${JSON.stringify(k)}:${canonicalize(value[k])}`;
      })
      .join(',')}}`;
  }
  throw new Error(`JCS: unsupported type ${typeof value}`);
};

module.exports = { canonicalize };
