#!/usr/bin/env node
/*
 * Attack kit f) MITM proxy vs SPKI pinning (REST + WSS + file)
 * Skeleton P0 (T-04): guard + kế hoạch; logic gọi API thật làm ở T-21 theo contracts/openapi.yaml v1.0.0.
 */
const { runScenario, notImplemented } = require('../lib/guard');

const meta = {
  id: 'f',
  title: "MITM proxy vs SPKI pinning (REST + WSS + file)",
  masvs: "MASVS-NETWORK",
  endpoints: ["HTTPS REST /v1/*","WSS /socket.io","PUT /uploads/{id}, GET /attachments/{id}"],
  steps: [
    "Control build qua proxy: REST + WSS thành công, proxy thấy request (chứng minh proxy hoạt động).",
    "Pinned build qua proxy: REST, upload/download file, WSS đều fail (pin mismatch).",
    "Pinned build trực tiếp tới gateway: tất cả pass.",
    "Ghi lại log proxy (redacted) + screenshot lỗi client."
  ],
};

// eslint-disable-next-line no-unused-vars
const main = async (ctx) => {
  // TODO(T-21): hiện thực các bước trong meta.steps, trả về { pass, checks: [{name, ok, requestId}] }.
  throw notImplemented('scenario f pending T-21');
};

if (require.main === module) {
  runScenario(meta, main, { destructive: false });
}

module.exports = { meta, main };
