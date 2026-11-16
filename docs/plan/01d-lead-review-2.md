# Lead review — vòng 2 (Claude phản hồi 01c-codex-rebuttal.md)

Lưu ý: 01c được viết TRƯỚC khi user chốt quyết định. Các quyết định của user (bắt buộc, không tranh luận lại):
1. **Deadline: hoàn thiện trong tháng 11/2026** (từ 16/11 → ~12 ngày code + 2 ngày rehearsal). Nhóm 3 người + AI agents song song.
2. **Backend tự viết** (môn ATBM).
3. **Có thiết bị Android thật.**
4. **Chat nhóm + chat 1-1, E2EE cho cả hai.** → R3 "không group" bị thay thế.

## Phán quyết các điểm còn mở

### D1. Realtime: chấp nhận lập luận "inbox ID-only + GET qua gateway" — và đi thêm một bước: BỎ FIREBASE KHỎI ĐƯỜNG DỮ LIỆU
Codex đã chứng minh custom token + Rules + lease + inbox ID-only là phức tạp, và khi ciphertext/history đều qua gateway thì Firestore chỉ còn là "chuông báo". Lead quyết định:
- **Gateway: Node.js TypeScript, Fastify + Socket.IO (WSS) + PostgreSQL (Prisma hoặc Drizzle) + file store ciphertext trên đĩa**, chạy bằng `docker-compose` trên laptop demo (LAN với điện thoại thật; tùy chọn Cloudflare Tunnel nếu cần internet).
- Socket.IO handshake xác thực bằng access JWT; mỗi API/socket event kiểm session active trong DB. **Revoke session → server ngắt socket ngay + refresh family revoked** → demo revoke tức thì, không cần lease.
- **Presence = trạng thái kết nối socket** (online ngay khi connect, offline sau grace ~10–30s khi disconnect), chỉ phát cho bạn bè/thành viên chat → R6/heartbeat/RTDB không còn là vấn đề.
- **TLS:** cert tự ký do CA riêng của nhóm (hoặc mkcert); app tin CA này qua `network_security_config` (config plugin) + **pin SPKI của gateway** → pinning bao phủ TOÀN BỘ traffic (REST + WSS) vì không còn Firebase SDK. Demo mitmproxy: control (không pin, CA user-trusted) vs pinned.
- **Firebase chỉ còn dùng cho FCM** (qua Expo Push, miễn phí) để thông báo khi app bị kill; payload generic. Nếu không kịp, notification foreground/background-socket là đủ, FCM là stretch.
- Hệ quả: gỡ Firebase JS SDK, Firestore Rules, Storage; client `src/services/*` viết lại thành `api/` (REST) + `realtime/` (socket). Đây là thay đổi lớn nhưng **đơn giản hóa** toàn bộ chuỗi auth/session/revoke/rate-limit và mọi cơ chế bảo mật đều là code của nhóm.
- Codex đánh giá phản biện D1 trong 02-final-plan (nếu phản đối phải nêu rủi ro cụ thể hơn chi phí viết lại services).

### D2. E2EE cho group + 1-1: một cơ chế chung
- Mỗi tin: content key 32B ngẫu nhiên → AES-256-GCM payload (AAD canonical: version, chatId, messageId, senderUserId, senderDeviceId, type, expiresAt, rosterRevision) → bọc content key cho **từng device active của từng thành viên** (X25519 static device key + HKDF-SHA256, info string có version/chatId/messageId/recipientDeviceId) → ký Ed25519 trên envelope canonical.
- Giới hạn: group ≤ 10 thành viên × ≤ 3 device ⇒ ≤ 30 wrap/tin, chấp nhận được. Sender Keys chỉ ghi là hướng tối ưu.
- Kick/leave: thành viên bị loại không có trong fanout tin mới; gateway kiểm audience khi đọc. Không FS, ghi rõ.
- Group RBAC: owner/admin/member (thêm/kick/đổi tên/thăng-giáng admin/giải tán), kiểm phía server + test negative.
- Safety number: theo cặp user (1-1) và danh sách fingerprint thành viên (group); key change → banner cảnh báo.

### D3. Lưu trữ file: local ciphertext store trên gateway (đồng ý điểm 3 của Codex). Giới hạn file 10 MiB nếu benchmark noble đạt, nếu không 5 MiB.

### D4. Timeline: 20 ngày bị bác vì vi phạm deadline user. Kế hoạch phải vừa **12 ngày code (17/11 → 28/11) + 29–30/11 rehearsal**, checkpoint ngày 18, 21, 24, 27. Scope theo tầng:
- **MUST** (8 chức năng + 10 cơ chế, group E2EE, attack kit cơ bản a–f, MASVS mapping).
- **SHOULD**: QR safety number, FLAG_SECURE, root/emulator warning, encrypted local cache, FCM khi app bị kill, pinning demo.
- **COULD**: SQLCipher, admin web dashboard, audit log UI.
Nếu gate trượt → cắt từ COULD rồi SHOULD, không cắt MUST.

### D5. Ownership song song (đề xuất để Codex chia task)
- **Codex**: `server/` (auth, sessions, RBAC, rate limit, chats/groups, messages, files, socket) + `src/security/` protocol core + review tích hợp.
- **Helper A (Gemini/antigravity)**: client UI — auth screens, profile, friends/search, group management, devices screen, safety number/QR, app lock.
- **Helper B (Claude worker)**: tests — crypto vectors, server integration tests (supertest), `security-demo/` attack kit, MASVS mapping, docs/báo cáo.
- Contract trước (ngày 17/11): OpenAPI + socket events + envelope JSON schema + DB schema, đóng băng để các luồng làm song song.

## Yêu cầu
Viết `docs/plan/02-final-plan.md` theo mục 2 của `01b-lead-review.md`, áp D1–D5. Có thể phản biện D1 trong một mục riêng "Bất đồng còn lại". Không sửa source code.
