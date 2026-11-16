# Contract changelog

## 1.0.0 — frozen-approved — 2026-11-16

- Đóng băng 53 REST operations trên 48 paths, error envelope và rate-limit metadata.
- Định nghĩa Socket.IO v1 cho websocket-only handshake, durable inbox cursor, presence và session lifecycle hints.
- Định nghĩa `wc-e2ee-v1`, recall control và binary attachment format `WCFILE1`.
- Thêm fixtures auth/direct/group/expiry/recall, gồm positive và negative examples.
- Định nghĩa 22 Prisma models cho account, device/session, social/group, immutable ciphertext, delivery, audit và limiter.
- Áp dụng điều kiện lead review: wrapped content key và roster hash cố định 32 byte; payload ciphertext tối đa 16.384 ký tự; envelope HTTP tối đa 256 KiB trước parse/verify; pending group invite dùng partial unique SQL index; xác nhận direct pair key unique.

Breaking changes sau freeze phải tăng contract version, cập nhật fixtures/tests và được lead + owner client/server duyệt.
