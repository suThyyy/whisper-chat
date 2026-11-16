#!/usr/bin/env node
/*
 * Attack kit c) Tamper 1 byte ciphertext/tag/AAD/wrap/signature
 * Skeleton P0 (T-04): guard + kế hoạch; logic gọi API thật làm ở T-21 theo contracts/openapi.yaml v1.0.0.
 */
const { runScenario, notImplemented } = require('../lib/guard');

const meta = {
  id: 'c',
  title: "Tamper 1 byte ciphertext/tag/AAD/wrap/signature",
  masvs: "MASVS-CRYPTO",
  endpoints: ["GET /chats/{chatId}/messages/{messageId}","SQL fixture role demo (thay Admin SDK)"],
  steps: [
    "Snapshot envelope gốc (hash) để reset.",
    "Lật 1 bit lần lượt ở payload.ciphertext, payload.tag, header (AAD), wraps[i].ciphertext, signature.",
    "Mỗi lần: client Bob mở chat → kỳ vọng \"Không xác thực được tin nhắn\", không render nội dung.",
    "Khôi phục envelope gốc → message hiển thị lại bình thường."
  ],
};

// eslint-disable-next-line no-unused-vars
const main = async (ctx) => {
  // TODO(T-21): hiện thực các bước trong meta.steps, trả về { pass, checks: [{name, ok, requestId}] }.
  throw notImplemented('scenario c pending T-21');
};

if (require.main === module) {
  runScenario(meta, main, { destructive: true });
}

module.exports = { meta, main };
