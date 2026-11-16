#!/usr/bin/env node
/*
 * Attack kit a) Brute-force login → 429/Retry-After/backoff
 * Skeleton P0 (T-04): guard + kế hoạch; logic gọi API thật làm ở T-21 theo contracts/openapi.yaml v1.0.0.
 */
const { runScenario, notImplemented } = require('../lib/guard');

const meta = {
  id: 'a',
  title: "Brute-force login → 429/Retry-After/backoff",
  masvs: "MASVS-AUTH, MASVS-NETWORK; backend ASVS V2/V11 (rate limiting)",
  endpoints: ["POST /auth/challenge","POST /auth/login"],
  steps: [
    "Gửi 11 login sai từ cùng IP trong 10 phút → kỳ vọng request thứ 11 bị 429 + header Retry-After (10/10phút/IP).",
    "Từ IP thứ hai (hoặc sau khi bucket IP hết hạn) thử 6 login sai cho cùng email → kỳ vọng 429 theo HMAC(email) (5/15phút).",
    "Đo độ trễ phản hồi tăng dần 1/2/4/8/16/30s (cap 30s).",
    "Restart container gateway → gửi thêm 1 login sai → vẫn 429 (bucket persistent).",
    "Sau khi hết cửa sổ, victim login đúng → 200 (không khóa vĩnh viễn)."
  ],
};

// eslint-disable-next-line no-unused-vars
const main = async (ctx) => {
  // TODO(T-21): hiện thực các bước trong meta.steps, trả về { pass, checks: [{name, ok, requestId}] }.
  throw notImplemented('scenario a pending T-21');
};

if (require.main === module) {
  runScenario(meta, main, { destructive: false });
}

module.exports = { meta, main };
