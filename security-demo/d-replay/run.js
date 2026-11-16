#!/usr/bin/env node
/*
 * Attack kit d) Replay / retry idempotency
 * Skeleton P0 (T-04): guard + kế hoạch; logic gọi API thật làm ở T-21 theo contracts/openapi.yaml v1.0.0.
 */
const { runScenario, notImplemented } = require('../lib/guard');

const meta = {
  id: 'd',
  title: "Replay / retry idempotency",
  masvs: "MASVS-CRYPTO, MASVS-NETWORK",
  endpoints: ["POST /chats/{chatId}/messages","GET /sync"],
  steps: [
    "Gửi lại E y nguyên (cùng messageId + envelopeHash) → 200 idempotent, đúng 1 message/unread/event, không push trùng.",
    "Gửi E với messageId khác (không ký lại) → reject (signature/AAD fail).",
    "Gửi E sang chatId khác → reject.",
    "Gửi E với counter đã dùng cho ID khác → 409.",
    "Cùng messageId, envelope khác hash → 409."
  ],
};

// eslint-disable-next-line no-unused-vars
const main = async (ctx) => {
  // TODO(T-21): hiện thực các bước trong meta.steps, trả về { pass, checks: [{name, ok, requestId}] }.
  throw notImplemented('scenario d pending T-21');
};

if (require.main === module) {
  runScenario(meta, main, { destructive: false });
}

module.exports = { meta, main };
