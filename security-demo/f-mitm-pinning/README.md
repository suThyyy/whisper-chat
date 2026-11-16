# f) MITM proxy vs SPKI pinning (REST + WSS + file)

| | |
|---|---|
| Task | T-03, T-21, T-22 |
| MASVS group | MASVS-NETWORK |
| Destructive | Không — cần `--demo-only` |
| Endpoint (contract v1.0.0) | `HTTPS REST /v1/*`, `WSS /socket.io`, `PUT /uploads/{id}, GET /attachments/{id}` |
| Trạng thái | Skeleton (P0). Chưa gọi API thật; hiện thực ở T-21 khi T-03 xong. |

## Prerequisites
- Proxy MITM (mitmproxy) với CA riêng của proxy; CA được trust trong cả control build và pinned lab build (cùng trust policy).
- Control build: package ID khác, KHÔNG phát hành như secure APK.
- Pinned build: SPKI pins chính + dự phòng của gateway.

## Các bước
1. Control build qua proxy: REST + WSS thành công, proxy thấy request (chứng minh proxy hoạt động).
2. Pinned build qua proxy: REST, upload/download file, WSS đều fail (pin mismatch).
3. Pinned build trực tiếp tới gateway: tất cả pass.
4. Ghi lại log proxy (redacted) + screenshot lỗi client.

## Expected result
Control MITM thành công; pinned fail cả REST/file/WSS; direct pass.

## Machine assertions
- [ ] control: proxy ghi nhận REST và WSS
- [ ] pinned: 0 request ứng dụng đi qua proxy thành công, cả 3 transport
- [ ] direct: pass

## Chạy
```sh
node security-demo/f-mitm-pinning/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run   # in kế hoạch
node security-demo/f-mitm-pinning/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1
```
Exit code: 0 pass, 1 assertion fail, 2 guard/setup, 3 chưa hiện thực.

Kịch bản có phần thao tác thiết bị/proxy thủ công; script chỉ kiểm tra điều kiện và thu evidence.

## Reset / cleanup
Xem `security-demo/README.md` mục Reset. Report chỉ ghi requestId và kết quả đã redact; không ghi password/token/key.
