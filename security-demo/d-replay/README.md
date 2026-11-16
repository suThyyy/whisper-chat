# d) Replay / retry idempotency

| | |
|---|---|
| Task | T-13, T-15, T-21 |
| MASVS group | MASVS-CRYPTO, MASVS-NETWORK |
| Destructive | Không — cần `--demo-only` |
| Endpoint (contract v1.0.0) | `POST /chats/{chatId}/messages`, `GET /sync` |
| Trạng thái | Skeleton (P0). Chưa gọi API thật; hiện thực ở T-21 khi T-13 xong. |

## Prerequisites
- Alice có envelope đã ký E (capture từ client test build, không chứa private key).
- Bob ở chat; đếm unread/event trước.

## Các bước
1. Gửi lại E y nguyên (cùng messageId + envelopeHash) → 200 idempotent, đúng 1 message/unread/event, không push trùng.
2. Gửi E với messageId khác (không ký lại) → reject (signature/AAD fail).
3. Gửi E sang chatId khác → reject.
4. Gửi E với counter đã dùng cho ID khác → 409.
5. Cùng messageId, envelope khác hash → 409.

## Expected result
Exact retry 200 idempotent; replay sửa đổi bị reject.

## Machine assertions
- [ ] exact retry = 200 cùng body
- [ ] Bob unread +1 duy nhất
- [ ] /sync chỉ 1 event cho messageId
- [ ] các biến thể replay = 4xx

## Chạy
```sh
node security-demo/d-replay/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run   # in kế hoạch
node security-demo/d-replay/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1
```
Exit code: 0 pass, 1 assertion fail, 2 guard/setup, 3 chưa hiện thực.

## Reset / cleanup
Xem `security-demo/README.md` mục Reset. Report chỉ ghi requestId và kết quả đã redact; không ghi password/token/key.
