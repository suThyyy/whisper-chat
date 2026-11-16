# P0 Codex — bằng chứng T-01/T-02

Ngày thực hiện: 2026-11-16. Contract: `v1.0.0`, trạng thái `frozen-approved`.

## Phạm vi hoàn thành

- T-01: OpenAPI 3.1, Socket.IO schema, E2EE envelope `wc-e2ee-v1`, fixtures, Prisma schema và tài liệu đóng băng.
- T-02: Node 22/TypeScript strict, Fastify, Prisma/PostgreSQL, Socket.IO websocket-only, Pino redaction, health route, auth handshake stub, Compose, CA/TLS/SPKI và migration đầu tiên.
- Gateway áp dụng giới hạn HTTP 256 KiB. E2EE schema giới hạn ciphertext 16.384 ký tự; `rosterHash` và wrapped content key là bytes32 base64url.

## Quyết định và độ lệch có chủ ý

- Dùng port `8443` thay cho `443` để không cần quyền quản trị và tránh xung đột dịch vụ trên máy phát triển.
- Host chuẩn là `whisperchat.local`; cert vẫn có SAN `whisperchat.lan`, `localhost`, `127.0.0.1`, `10.0.2.2` và IP LAN cấu hình khi sinh cert.
- P0 handshake dùng token ngẫu nhiên cục bộ trong `server/.env`; chưa phải JWT. Mục tiêu của stub là chứng minh từ chối kết nối thiếu/sai token.
- `GroupInvite` dùng partial unique index khi trạng thái `PENDING`; direct chat dùng `directPairKey` duy nhất; migration có check constraint cho canonical friendship và loại chat.
- PostgreSQL không publish port ra host/LAN. Chỉ reverse proxy TLS publish `8443`.

## Artefact cho Android

- Endpoint: `https://whisperchat.local:8443` (emulator có thể dùng `https://10.0.2.2:8443`; máy thật dùng IP LAN nằm trong SAN).
- Trust anchor: `infra/public/ca.crt`.
- Pin manifest: `infra/public/pins.json`, gồm pin chính và pin dự phòng dạng SPKI SHA-256 base64 cùng ngày hết hạn.
- Pin chính: `sha256/Mj9lwgmPTpEYCBRJq5kImqNtrd0+Uk11ZH0zJI1mb5Y=`; pin dự phòng: `sha256/vUFtjgfkBR3A8ld/VVuwkpWBVC1NjiCIlisyOwsLoFU=`; hết hạn `2029-02-18`.

## File thuộc phần Codex

- `contracts/`: `openapi.yaml`, hai JSON Schema, fixtures, `FROZEN.md`, `CHANGELOG.md`.
- `server/`: source gateway, hai test, Prisma schema/migration, Dockerfile, package/lock, cấu hình TypeScript/ESLint, README và `.env.example`.
- `infra/`: Caddyfile, script PowerShell, CA/cert/pin công khai; private key/CSR/ext nằm trong `infra/secrets/` đã gitignore.
- Gốc repo: `compose.yaml` và các dòng ignore bí mật trong `.gitignore`.

## Kết quả kiểm tra

- `npm run build`: PASS.
- `npm test`: PASS, 2/2 test (`GET /v1/health`, socket thiếu token bị từ chối).
- `npm run lint`: PASS.
- `prisma validate`: PASS; migration SQL được sinh và có ba invariant bổ sung.
- `docker compose up -d --build`: PASS sau khi giải phóng dung lượng Docker và rebuild không dùng cache; ba service `db`, `gateway`, `proxy` đều chạy, `db`/`gateway` healthy. DB chỉ hiện `5432/tcp`; proxy publish `8443`.
- `docker compose exec -T gateway npm run migrate`: PASS, migration `20261116000100_init` được áp dụng.
- `curl.exe --ssl-no-revoke --cacert infra/public/ca.crt --resolve "whisperchat.local:8443:[::1]" https://whisperchat.local:8443/v1/health`: PASS, trả `{"status":"ready"}`. Dùng IPv6 loopback vì tiến trình test song song của Helper đang chiếm IPv4 `0.0.0.0:8443`; Compose vẫn publish cả IPv4/IPv6.
- Sau `docker compose restart`, truy vấn PostgreSQL trả `pgdata-survives-restart`, file trong volume ciphertext trả `ciphertext-survives-restart`, health vẫn trả ready. Hai named volume được xác nhận giữ dữ liệu.
- TLS tĩnh: `openssl verify -CAfile infra/public/ca.crt infra/public/server.crt` PASS; cert có đủ SAN và `pins.json` parse thành công.

`npm audit --omit=dev` báo 3 high trong chuỗi CLI `prisma -> @prisma/config -> deepmerge-ts` (GHSA-ggr8-5vv4-36mx); không nằm trên request path, nhưng cần xử lý khi Prisma 7 được duyệt vì fix hiện tại là major upgrade.
