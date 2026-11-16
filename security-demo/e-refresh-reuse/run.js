#!/usr/bin/env node
/*
 * Attack kit e) Refresh token reuse → revoke family + disconnect
 * Skeleton P0 (T-04): guard + kế hoạch; logic gọi API thật làm ở T-21 theo contracts/openapi.yaml v1.0.0.
 */
const { runScenario, notImplemented } = require('../lib/guard');

const meta = {
  id: 'e',
  title: "Refresh token reuse → revoke family + disconnect",
  masvs: "MASVS-AUTH",
  endpoints: ["POST /auth/refresh","GET /me","socket handshake","GET /sessions"],
  steps: [
    "S1 refresh R1 → nhận R2 (+ access mới).",
    "Dùng lại R1 → kỳ vọng 401 và family S1 bị revoke (audit ghi reuse).",
    "Socket của S1 bị disconnect ≤1s (≤5s sweep).",
    "Access JWT cũ của S1 gọi GET /me và POST message → 401.",
    "R2 cũng không dùng được nữa.",
    "S2 vẫn hoạt động bình thường (không revoke nhầm)."
  ],
};

// eslint-disable-next-line no-unused-vars
const main = async (ctx) => {
  // TODO(T-21): hiện thực các bước trong meta.steps, trả về { pass, checks: [{name, ok, requestId}] }.
  throw notImplemented('scenario e pending T-21');
};

if (require.main === module) {
  runScenario(meta, main, { destructive: false });
}

module.exports = { meta, main };
