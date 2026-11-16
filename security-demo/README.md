# WhisperChat Secure — Attack kit (a–g)

Bộ kịch bản tấn công/kiểm chứng cho demo theo `docs/plan/02-final-plan.md` mục 8. Trạng thái: **skeleton P0 (T-04)** — có guard, kế hoạch, assertion, MASVS mapping; logic gọi API thật hiện thực ở T-21 dựa trên `contracts/openapi.yaml` v1.0.0 (frozen-approved).

> Chỉ chạy trên host/DB demo của nhóm. Không chạy trên production hoặc dữ liệu thật. Không có secret trong thư mục này.

## Mục tiêu

| # | Thư mục | Nội dung / expected | Task | MASVS group |
|---|---|---|---|---|
| a | `a-bruteforce/` | Brute-force login → 429 + Retry-After + backoff; account hợp lệ không bị khóa vĩnh viễn; restart không reset limiter | T-06, T-09, T-21 | AUTH, NETWORK |
| b | `b-idor/` | User thứ ba đoán chat/message/file ID qua REST, forged event qua socket → 404/403, không dữ liệu; kicked/new device bị chặn history | T-10, T-13, T-15, T-21 | AUTH |
| c | `c-tamper/` | Lật 1 bit ciphertext/tag/AAD/wrap/signature (SQL fixture quyền demo) → client "Không xác thực được tin nhắn" | T-12, T-15, T-21 | CRYPTO |
| d | `d-replay/` | Replay đổi messageId/chat/counter → reject; exact retry cùng hash → 200 idempotent, đúng 1 message/unread/event | T-13, T-15, T-21 | CRYPTO, NETWORK |
| e | `e-refresh-reuse/` | Refresh R1→R2 rồi reuse R1 → family + sid revoked, socket disconnect, access cũ bị chặn; sid độc lập không ảnh hưởng | T-05, T-09, T-21 | AUTH |
| f | `f-mitm-pinning/` | Proxy CA trust ở control build: MITM thành công; pinned build cùng trust: REST/file/WSS fail; direct pass | T-03, T-21, T-22 | NETWORK |
| g | `g-at-rest/` | Dump AsyncStorage/cache trên rooted emulator → không plaintext/password/refresh/private key | T-07, T-12, T-17, T-21 | STORAGE, CRYPTO |

a–f là MUST; g chạy nếu có môi trường root (mã hóa outbox/secrets vẫn MUST dù không quay được dump). Mapping theo **nhóm control** MASVS, không tuyên bố đạt toàn bộ control/certification.

## Prerequisites chung

- Node ≥ 20 (đã dùng 22.13).
- Gateway demo chạy qua TLS reverse proxy (Compose của C, T-02), hostname cố định (mặc định `whisperchat.lan`).
- DB demo riêng, có seed users/devices/roles do C cung cấp (CLI seed, không public bootstrap route).
- CA lab public cert được trust theo domain trên máy chạy script; **không** dùng `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Biến môi trường (không commit):
  - `WC_DEMO_BASE_URL` — ví dụ `https://whisperchat.lan:8443/v1`
  - `WC_DEMO_ALLOWED_HOSTS` — allowlist, mặc định `whisperchat.lan,localhost,127.0.0.1`
  - `WC_DEMO_DATABASE_ID` — ID DB demo, bắt buộc cho kịch bản destructive (c)
  - Credentials demo đọc từ file seed ngoài repo do C chỉ định, không hard-code.

## Guard

Mọi script dùng `lib/guard.js`:

1. Bắt buộc `--demo-only`, nếu thiếu → exit 2.
2. Base URL phải `https:` và hostname nằm trong allowlist → nếu không, exit 2.
3. Kịch bản destructive (c) cần thêm `--confirm-db=<id>` trùng `WC_DEMO_DATABASE_ID`.
4. `--dry-run` chỉ in các bước, không gửi request.
5. Output đi qua `redact()` (JWT, Bearer, password/token/key fields); report chỉ log `requestId` và kết quả.

Exit code: `0` pass · `1` assertion fail · `2` guard/setup · `3` chưa hiện thực.

```sh
node security-demo/a-bruteforce/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run
```

## Reset

- Limiter/audit/test users: dùng lệnh reset seed demo của C (T-02) **chỉ** trên `WC_DEMO_DATABASE_ID`; không chạy destructive reset mặc định.
- Kịch bản c: script snapshot envelope gốc (hash) trước khi sửa và khôi phục sau; xác minh hash trùng.
- Kịch bản e: login lại tạo session mới; session bị revoke giữ nguyên để làm evidence audit.
- Kịch bản f: gỡ proxy CA khỏi thiết bị sau demo; gỡ control build.
- Kịch bản g: wipe emulator snapshot.

## Evidence

Output JSON đã redact mỗi kịch bản → `docs/security/evidence/` (T-21/T-23). Không lưu password/token/key/plaintext message trong evidence.
