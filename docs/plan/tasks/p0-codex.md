# P0 — Codex: T-01 (contract freeze) rồi T-02 (server skeleton + infra)

Repo: D:\ForIntern\WhisperChat-Ctere1. Kế hoạch duyệt: `docs/plan/02-final-plan.md` (đọc kỹ mục 1–7 và Lead sign-off ở đầu file). Lead (review). Trả lời/ghi chú tiếng Việt, code tiếng Anh.

Song song với bạn trong CÙNG working tree: Helper A (Antigravity) làm T-03 (client: Users.js, App.js, contexts, app.config.js, plugins/, root package.json/lock, android/ prebuild); Helper B làm T-04 (tests/regression, tests/contracts, tests/security/vectors, security-demo/). KHÔNG sửa file của họ.

## Quyền sửa file (P0)
- ĐƯỢC: `contracts/**`, `server/**` (kể cả `server/package.json`, lock riêng của server), `compose.yaml`, `infra/**`, `.gitignore` (chỉ thêm dòng cho server/infra secrets), `docs/plan/03-p0-codex-notes.md`.
- KHÔNG: root `package.json`/`package-lock.json` (thuộc A trong P0), `src/**`, `tests/**`, `security-demo/**`, `app.config.js`.
- KHÔNG git commit/push/branch — lead sẽ commit sau review.
- Secrets (JWT signing key, CA private key, DB password) KHÔNG vào repo: tạo bằng script `infra/scripts/*` ra thư mục gitignored (vd `infra/secrets/`), có `.env.example`.

## T-01 — Contract freeze (làm trước, mục tiêu xong sớm nhất có thể)
Tạo theo mục 3–6 của plan:
- `contracts/openapi.yaml` (OpenAPI 3.1): mọi endpoint ở bảng mục 6, request/response schema, error format `{code,message,requestId,retryAfterSeconds?}`, security scheme, ghi rate limit bằng extension `x-rate-limit`.
- `contracts/socket-events.schema.json`: handshake + events mục 6.
- `contracts/e2ee-envelope.schema.json`: Envelope `wc-e2ee-v1`, control recall, file format note (mục 5). additionalProperties=false.
- `contracts/fixtures/*.json`: ví dụ hợp lệ + không hợp lệ (auth, direct, group, expiry, recall) — dữ liệu giả, không secret.
- `contracts/CHANGELOG.md` (v1.0.0-freeze).
- `server/prisma/schema.prisma` theo bảng mục 4.
Khi T-01 xong: viết `contracts/FROZEN.md` ghi trạng thái "ready-for-review" và GỬI `ask` cho lead với tóm tắt (endpoint count, bảng DB, điểm nào lệch plan). Lead review rồi trả lời; trong lúc chờ có thể làm T-02 phần không phụ thuộc contract (compose/TLS/health).

## T-02 — Server skeleton + infra
- `server/`: Node 22 + TypeScript strict, Fastify, Prisma (PostgreSQL), Socket.IO v4 (websocket-only, polling tắt), zod hoặc ajv validate theo contracts, pino logger có redaction (authorization, password, token, refresh, envelope.payload, wraps).
- Route `GET /v1/health` (ready only). Socket handshake stub từ chối khi không có token hợp lệ (chưa cần JWT thật — trả lỗi chuẩn).
- `compose.yaml`: `db` (postgres 16, KHÔNG publish port ra LAN; nếu cần debug bind 127.0.0.1), `gateway`, `proxy` TLS (Caddy hoặc nginx) publish 443 (hoặc 8443) cho LAN; named volumes `pgdata`, `ciphertext`. 
- `infra/scripts/`: tạo CA riêng của nhóm + cert server với SAN là hostname cố định (đề xuất `whisperchat.lan`, cộng IP LAN cấu hình qua biến) — PowerShell hoặc Node script chạy được trên Windows; in ra SPKI pin SHA-256 (base64) của cert server + một backup key pin. Xuất CA cert công khai ra `infra/public/ca.crt` (được commit) để Helper A nhúng vào app.
- Prisma migration đầu tiên; `npm run` scripts: dev, build, test, lint, migrate.
- Test tối thiểu trong `server/test/` (của bạn): health 200 qua Fastify inject; socket không token bị từ chối.
- `server/README.md`: cách chạy trên Windows + Docker Desktop, cách điện thoại cùng LAN truy cập (hosts/DNS hoặc IP), firewall.

## Evidence khi xong (worker_done)
- Output thật của: `docker compose up -d` + `docker compose ps`; `curl --cacert infra/public/ca.crt https://<host>:<port>/v1/health`; server tests; restart compose giữ data (chứng minh volume).
- Danh sách file tạo; SPKI pins; hostname/port Helper A cần; mọi lệch so với plan.
- Lệnh fail = báo đúng như vậy, không che. Không được sửa file ngoài vùng cho phép.
