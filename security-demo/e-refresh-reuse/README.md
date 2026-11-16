# e) Refresh token reuse → revoke family + disconnect

| | |
|---|---|
| Task | T-05, T-09, T-21 |
| MASVS group | MASVS-AUTH |
| Destructive | Không — cần `--demo-only` |
| Endpoint (contract v1.0.0) | `POST /auth/refresh`, `GET /me`, `socket handshake`, `GET /sessions` |
| Trạng thái | Skeleton (P0). Chưa gọi API thật; hiện thực ở T-21 khi T-05 xong. |

## Prerequisites
- Alice login trên 2 session độc lập S1, S2 (2 device demo).
- S1 giữ R1 + socket đang kết nối.

## Các bước
1. S1 refresh R1 → nhận R2 (+ access mới).
2. Dùng lại R1 → kỳ vọng 401 và family S1 bị revoke (audit ghi reuse).
3. Socket của S1 bị disconnect ≤1s (≤5s sweep).
4. Access JWT cũ của S1 gọi GET /me và POST message → 401.
5. R2 cũng không dùng được nữa.
6. S2 vẫn hoạt động bình thường (không revoke nhầm).

## Expected result
Family + sid revoked, socket disconnect, sid độc lập không ảnh hưởng.

## Machine assertions
- [ ] reuse → 401
- [ ] disconnect latency đo được ≤1s (ghi số)
- [ ] stale access bị từ chối
- [ ] S2 = 200

## Chạy
```sh
node security-demo/e-refresh-reuse/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run   # in kế hoạch
node security-demo/e-refresh-reuse/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1
```
Exit code: 0 pass, 1 assertion fail, 2 guard/setup, 3 chưa hiện thực.

## Reset / cleanup
Xem `security-demo/README.md` mục Reset. Report chỉ ghi requestId và kết quả đã redact; không ghi password/token/key.
