#!/usr/bin/env node
/*
 * Attack kit b) IDOR: user thứ ba đoán chat/message/file ID qua REST và socket
 * Skeleton P0 (T-04): guard + kế hoạch; logic gọi API thật làm ở T-21 theo contracts/openapi.yaml v1.0.0.
 */
const { runScenario, notImplemented } = require('../lib/guard');

const meta = {
  id: 'b',
  title: "IDOR: user thứ ba đoán chat/message/file ID qua REST và socket",
  masvs: "MASVS-AUTH; backend ASVS V4 (access control)",
  endpoints: ["GET /chats/{chatId}/messages","GET /chats/{chatId}/messages/{messageId}","GET /attachments/{attachmentId}","GET /chats/{chatId}/roster","socket sync.request / event.ack"],
  steps: [
    "Mallory GET từng resource của Alice/Bob → kỳ vọng 404 (foreign object, không lộ tồn tại).",
    "Mallory gửi socket event lạ / join room / sync.request với cursor của người khác → bị reject, không nhận inbox.changed của chat đó.",
    "Carol (đã kick) GET history group → 403/404, không ciphertext.",
    "Device mới của Alice GET message cũ → không có wrap cho device (không audience) → deny."
  ],
};

// eslint-disable-next-line no-unused-vars
const main = async (ctx) => {
  // TODO(T-21): hiện thực các bước trong meta.steps, trả về { pass, checks: [{name, ok, requestId}] }.
  throw notImplemented('scenario b pending T-21');
};

if (require.main === module) {
  runScenario(meta, main, { destructive: false });
}

module.exports = { meta, main };
