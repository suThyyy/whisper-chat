# b) IDOR: user thứ ba đoán chat/message/file ID qua REST và socket

| | |
|---|---|
| Task | T-10, T-13, T-15, T-21 |
| MASVS group | MASVS-AUTH; backend ASVS V4 (access control) |
| Destructive | Không — cần `--demo-only` |
| Endpoint (contract v1.0.0) | `GET /chats/{chatId}/messages`, `GET /chats/{chatId}/messages/{messageId}`, `GET /attachments/{attachmentId}`, `GET /chats/{chatId}/roster`, `socket sync.request / event.ack` |
| Trạng thái | Skeleton (P0). Chưa gọi API thật; hiện thực ở T-21 khi T-10 xong. |

## Prerequisites
- Alice + Bob có direct chat với ít nhất 1 message + 1 attachment.
- Mallory là user hợp lệ, không phải member; biết chatId/messageId/attachmentId (lấy từ fixture seed).
- Thêm: Carol bị kick khỏi group; device mới của Alice enroll sau message.

## Các bước
1. Mallory GET từng resource của Alice/Bob → kỳ vọng 404 (foreign object, không lộ tồn tại).
2. Mallory gửi socket event lạ / join room / sync.request với cursor của người khác → bị reject, không nhận inbox.changed của chat đó.
3. Carol (đã kick) GET history group → 403/404, không ciphertext.
4. Device mới của Alice GET message cũ → không có wrap cho device (không audience) → deny.

## Expected result
404/403, không dữ liệu; kicked/new device bị chặn history.

## Machine assertions
- [ ] không response nào chứa field envelope/ciphertext
- [ ] 404 cho ID ngoại lai, không phân biệt "không tồn tại" và "không có quyền"
- [ ] socket không phát event cho người ngoài

## Chạy
```sh
node security-demo/b-idor/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run   # in kế hoạch
node security-demo/b-idor/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1
```
Exit code: 0 pass, 1 assertion fail, 2 guard/setup, 3 chưa hiện thực.

## Reset / cleanup
Xem `security-demo/README.md` mục Reset. Report chỉ ghi requestId và kết quả đã redact; không ghi password/token/key.
