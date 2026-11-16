# Lead review — vòng 1 (Claude phản biện bản khảo sát 01-codex-survey.md)

Đánh giá chung: khảo sát chất lượng tốt, bằng chứng chính xác (đã spot-check: TDZ `handleName` ở `src/screens/Users.js:107/115` là thật; Rules deny-by-default và messages immutable đúng; `functions/` không tồn tại). Tuy nhiên kế hoạch đang tối ưu cho "sản phẩm thật" chứ chưa tối ưu cho **đồ án môn bảo mật mobile**: quá dài (5–8 tuần), phụ thuộc Cloud Functions (cần gói Blaze), và để 3/10 cơ chế (JWT/Refresh, Password hashing, Rate limiting) là "Firebase lo hộ" — rất khó ghi điểm khi giảng viên hỏi "code đâu?".

## Điểm phản biện (Codex trả lời từng điểm: Đồng ý / Không đồng ý + lý do / Đề xuất thay thế)

### R1. Kiến trúc backend: Firebase thuần + Functions → đề xuất HYBRID với backend tự viết
- Cloud Functions yêu cầu Blaze (billing) → rủi ro triển khai cho sinh viên.
- Đề xuất: **Node.js (TypeScript, Fastify hoặc Express) "security gateway"** trong thư mục `server/`, chạy local/Render free tier, dùng Firebase Admin SDK (service account, KHÔNG cần Blaze):
  - Tự quản lý tài khoản: **Argon2id** (tham số ghi rõ, benchmark), policy mật khẩu.
  - Tự phát **JWT access token (ngắn, ~15 phút, ES256/EdDSA)** + **opaque refresh token rotation, lưu hash, token family + reuse detection** → thu hồi theo từng phiên/thiết bị là thật, demo được.
  - Sau login, gateway mint **Firebase custom token** có claim `sid`, `deviceId`, `role` để client vẫn dùng Firestore `onSnapshot` realtime; Rules kiểm `sessions/{sid}.active`.
  - **Rate limiting** (`rate-limiter-flexible`, theo IP + account + device): login, register, send, search, upload-init, friend request → 429 + lockout lũy tiến.
  - **RBAC** thật: role `user`/`admin` (+ `moderator` tùy chọn), middleware kiểm quyền, admin endpoint xem audit log/khóa user — không chỉ "membership".
  - **Gửi tin đi qua gateway** (validate envelope/schema/signature format, membership, rate limit, idempotency), Rules cấm client write trực tiếp vào `messages`. Nhận tin vẫn qua Firestore realtime.
  - HTTPS cho gateway → **certificate pinning trên endpoint của nhóm** trở nên rẻ và demo được bằng mitmproxy/Burp (bonus #7 hạ từ M–L xuống S–M).
- Câu hỏi cho Codex: Firebase email/password Auth có nên giữ song song không? Lead nghiêng về **bỏ** (gateway là nguồn duy nhất, chỉ dùng custom token) để tránh đường bypass. Phản biện nếu thấy rủi ro.

### R2. Crypto library: ưu tiên `@noble/ciphers` (AES-256-GCM) + `@noble/curves` + `@noble/hashes`
- `expo-crypto` hiện **chưa có trong dependencies**; native AES không chạy được trong Jest → khó có test vectors/tamper tests trong CI.
- Đề xuất: pure-JS noble (audited) cho toàn bộ primitive để module `src/security/crypto` test được bằng Jest với vector chuẩn (NIST GCM, RFC 7748, RFC 8032, RFC 5869); `expo-crypto.getRandomBytes` (hoặc `react-native-get-random-values`) chỉ làm CSPRNG. Codex đánh giá hiệu năng file ≤10 MiB trên Hermes.

### R3. Thu hẹp E2EE MVP
- Đồng ý: chỉ 1-1, static X25519 + HKDF + AES-GCM + Ed25519, ghi rõ không có FS.
- Cắt: **chuyển lịch sử sang thiết bị mới** (thiết bị mới chỉ thấy tin từ lúc enroll — như Signal), key-transparency log, group E2EE (tắt tạo group trong bản secure).
- Giữ: fanout tới tất cả device active (giới hạn 3/user), safety number + QR, cảnh báo key change.
- Hỏi Codex: có nên đưa **"Double Ratchet rút gọn" thành stretch goal** sau P3 không, hay chỉ trình bày như hướng phát triển? Lead nghiêng về hướng phát triển.

### R4. Rút timeline về quy mô đồ án
- Đề xuất ngân sách mục tiêu **~3–4 tuần** với nhiều agent song song; mỗi phase kết thúc bằng một **demo checkpoint** chạy được. Codex sắp lại phase theo critical path:
  P0 nền tảng (fix bug, dev build, Rules emulator, `server/` skeleton) → P1 auth/session/RBAC/rate limit (gateway) ∥ Keystore+biometric+FLAG_SECURE (client) → P2 friends/profile/devices UI → P3 E2EE text + integrity + safety number → P4 file mã hóa + recall/delete/self-destruct + pagination/SQLCipher → P5 presence/push + attack demo kit + MASVS mapping + báo cáo.
- Cắt/hoãn: 2FA TOTP (để stretch), Play Integrity (chỉ làm root/emulator detection mức cảnh báo bằng thư viện nhẹ), key transparency.

### R5. Bổ sung "Attack demo kit" như deliverable chính
Thư mục `security-demo/` gồm script tái lập được: (a) brute-force login → 429/lockout; (b) IDOR đọc chat người khác qua REST/SDK → denied; (c) sửa 1 byte ciphertext bằng Admin SDK → client báo "tin nhắn bị chỉnh sửa"; (d) replay envelope cũ → bị từ chối; (e) refresh token reuse → cả family bị thu hồi; (f) MITM bằng mitmproxy → pinning chặn; (g) dump AsyncStorage/SQLite trên emulator root → chỉ thấy ciphertext. Mỗi kịch bản map vào MASVS.

### R6. Presence & push không cần Functions
- Presence: RTDB `onDisconnect` (Spark miễn phí) — đồng ý, cần thêm `databaseURL`.
- Push: gateway gửi qua **Expo Push Service/FCM HTTP v1** khi nhận send request — payload generic. Không cần Firestore trigger.
- Self-destruct/cleanup: job định kỳ trong gateway (node-cron) + client timer.

### R7. Nợ kỹ thuật cần đưa vào P0
TDZ Users.js, `isMessageYourselfExists` so với `2`, retry `set` vs Rules cấm update, outbox không namespace UID (finding Cao) — Codex xác nhận đưa vào P0/P1 với test hồi quy.

## Yêu cầu cho Codex ở vòng này
1. Trả lời R1–R7 trong `docs/plan/01c-codex-rebuttal.md` (đồng ý/không, lý do kỹ thuật, rủi ro mới phát sinh — đặc biệt: custom token + Rules kiểm sid có kín mọi đường không; refresh custom token khi access JWT hết hạn; chi phí đọc Rules `get()` mỗi request).
2. Sau đó viết bản hợp nhất **`docs/plan/02-final-plan.md`**: kiến trúc đích (sơ đồ mermaid), data model/collections + Rules mới, đặc tả protocol E2EE (envelope, AAD, KDF info strings, versioning), API gateway (endpoint, auth, rate limit từng route), task breakdown theo phase với ID task (T-xx), owner đề xuất (Codex / Gemini / helper), file được sửa, phụ thuộc, acceptance test cụ thể; bảng mapping 8 chức năng + 10 cơ chế + bonus → task → bằng chứng demo → MASVS; danh sách quyết định còn mở cho user.
3. Không sửa source code ở vòng này.
