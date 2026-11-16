# c) Tamper 1 byte ciphertext/tag/AAD/wrap/signature

| | |
|---|---|
| Task | T-12, T-15, T-21 |
| MASVS group | MASVS-CRYPTO |
| Destructive | Có — cần `--demo-only --confirm-db=<WC_DEMO_DATABASE_ID>` |
| Endpoint (contract v1.0.0) | `GET /chats/{chatId}/messages/{messageId}`, `SQL fixture role demo (thay Admin SDK)` |
| Trạng thái | Skeleton (P0). Chưa gọi API thật; hiện thực ở T-21 khi T-12 xong. |

## Prerequisites
- Message E2EE đã commit giữa Alice/Bob.
- Quyền SQL demo trên DB lab (WC_DEMO_DATABASE_ID) — KHÔNG chạy trên DB khác.
- Backup/snapshot envelope trước khi sửa để reset.

## Các bước
1. Snapshot envelope gốc (hash) để reset.
2. Lật 1 bit lần lượt ở payload.ciphertext, payload.tag, header (AAD), wraps[i].ciphertext, signature.
3. Mỗi lần: client Bob mở chat → kỳ vọng "Không xác thực được tin nhắn", không render nội dung.
4. Khôi phục envelope gốc → message hiển thị lại bình thường.

## Expected result
Client báo "Không xác thực được tin nhắn" cho mọi biến thể; bản gốc vẫn đọc được sau reset.

## Machine assertions
- [ ] mọi biến thể bị reject với cùng generic error
- [ ] không plaintext rò ra log/UI
- [ ] reset trả về hash gốc

## Chạy
```sh
node security-demo/c-tamper/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run   # in kế hoạch
node security-demo/c-tamper/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --confirm-db=$WC_DEMO_DATABASE_ID
```
Exit code: 0 pass, 1 assertion fail, 2 guard/setup, 3 chưa hiện thực.

## Reset / cleanup
Xem `security-demo/README.md` mục Reset. Report chỉ ghi requestId và kết quả đã redact; không ghi password/token/key.
