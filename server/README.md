# WhisperChat secure gateway (P0)

## Yêu cầu

- Node.js 22 và npm 10 (chạy test/lint trực tiếp).
- Docker Desktop với Compose v2.
- OpenSSL có trong `PATH` và PowerShell 5.1+.

## Khởi tạo bí mật và chứng chỉ

Từ thư mục gốc repo, chạy:

```powershell
.\infra\scripts\Initialize-DevSecrets.ps1 -LanIp 192.168.1.25
```

Thay IP bằng địa chỉ Wi-Fi/Ethernet của máy chạy gateway. Script tạo CA, cert chính/dự phòng, mật khẩu DB và token stub; chỉ `infra/public/ca.crt`, các cert công khai và `infra/public/pins.json` được đưa vào source. Dùng `-Force` chỉ khi chủ động xoay toàn bộ bí mật/chứng chỉ.

## Chạy bằng Docker

```powershell
docker compose config
docker compose build gateway
docker compose up -d
docker compose run --rm gateway npm run migrate
docker compose ps
curl.exe --noproxy "*" --ssl-no-revoke --cacert infra/public/ca.crt --resolve whisperchat.local:8443:127.0.0.1 https://whisperchat.local:8443/v1/health
```

PostgreSQL chỉ ở mạng Docker, không publish port. TLS gateway được publish tại `https://whisperchat.local:8443`; `/v1/health` phải trả `{"status":"ready"}`. `--ssl-no-revoke` chỉ tránh kiểm tra CRL không tồn tại của CA demo khi dùng Windows Schannel; xác minh chuỗi và hostname vẫn bật.

## Chạy kiểm tra cục bộ

```powershell
cd server
npm ci
npm run prisma:generate
npm run build
npm test
npm run lint
```

## Điện thoại thật và emulator

Cert chứa SAN `whisperchat.local`, `whisperchat.lan`, `localhost`, `127.0.0.1`, `10.0.2.2` và IP truyền qua `-LanIp`. Android emulator gọi `https://10.0.2.2:8443`; điện thoại cùng Wi-Fi gọi IP LAN đã cấp trong cert. Nếu client dùng hostname, cấu hình DNS/hosts trên mạng thử nghiệm để `whisperchat.local` trỏ tới IP LAN. Cho phép inbound TCP 8443 trong Windows Firewall trên profile Private; không mở port PostgreSQL. CA và hai SPKI pin trong `infra/public/` là đầu vào cho cấu hình trust/pinning của Android.

## Ghi chú P0

Socket.IO chỉ cho `websocket`, không fallback polling. P0 dùng `P0_SOCKET_TOKEN` để chứng minh handshake thiếu/sai token bị từ chối; JWT thật được triển khai ở pha kế tiếp. Fastify giới hạn request body 256 KiB và dùng Ajv tích hợp để kiểm tra schema route; Pino che các trường xác thực và E2EE nhạy cảm.
