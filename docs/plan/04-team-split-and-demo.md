# WhisperChat Secure — Chia việc theo người & Kịch bản demo

Ngày lập: 24/11/2026 · Hạn: code xong **28/11**, tổng duyệt **29–30/11**.
Căn cứ: `02-final-plan.md` (kèm Amendment A1, A2). Tài liệu này **ghi đè cột Owner** trong bảng task mục 7 của plan: từ nay owner là **người**, mỗi người tự điều khiển agent (Codex/Claude) cho phần của mình.

> Nguyên tắc chia: giảng viên sẽ hỏi **từng người**, nên mỗi người sở hữu trọn một "lát dọc" gồm **cơ chế bảo mật + chức năng dùng cơ chế đó**, từ server → app → test → demo. Ai làm phần nào thì tự demo và tự trả lời câu hỏi phần đó. Ai cũng phải nắm **kiến trúc tổng** (mục 5) để trả lời câu hỏi chung.

---

## 1. Bảng phân công tổng

| | **Bạn** — Lát 2: Tin nhắn & Mật mã | **Hải** — Lát 1: Danh tính & Phiên | **Quân** — Lát 3: Truy cập & Bảo vệ thiết bị |
|---|---|---|---|
| **Chức năng (đề cương)** | F3 Nhắn tin 1-1 realtime (+ nhóm) · F4 Ảnh/tệp đính kèm · F5 Lịch sử trò chuyện · F7 Thu hồi/xóa/tự hủy | F1 Đăng ký/đăng nhập/tài khoản/hồ sơ (+avatar) · F8 Quản lý thiết bị & phiên | F2 Tìm kiếm/kết bạn/bạn bè · F6 Online/offline & thông báo (push) · Nhóm chat: thành viên & vai trò |
| **Cơ chế bảo mật (đề cương)** | S1 E2EE · S2 AES-256-GCM · S10 Message Integrity | S4 JWT & Refresh Token · S5 Password Hashing (Argon2id) · S9 Rate Limiting · S6 Android Keystore · S7 Biometric | S3 TLS/HTTPS + Certificate Pinning · S8 RBAC & Access Control |
| **Bonus (A1/A2)** | Xóa EXIF/GPS ảnh · Kiểm tra tệp phía client · Safety number/QR · Clipboard tự xóa 30s | Audit log đăng nhập/thiết bị · Tắt backup (allowBackup) | FLAG_SECURE + che Recent Apps · Root/Emulator/Debugger · Hardening manifest · Release hardening (R8, ký APK) · Màn hình Admin · TLS 1.2/1.3 + HSTS |
| **Demo tấn công (security-demo)** | c Tamper · d Replay | a Brute-force · e Refresh reuse · g Dump dữ liệu at-rest | b IDOR · f MITM/Pinning |
| **Task plan gốc** | T-12, T-13, T-14, T-16, T-17, T-18 | T-05, T-06 (rate-limit, audit), T-07, T-08 (auth client), T-09 | T-10, T-11, T-15 (phần quyền), T-19, T-20, T-21 f, T-22 |

> Tên người ở cột có thể đổi cho nhau, **nhưng giữ nguyên ranh giới lát**. Lát 2 khó nhất (mật mã) nên giao người chắc kỹ thuật nhất và là người tích hợp cuối.

---

## 2. Ranh giới file (tránh giẫm chân nhau)

| Lát | Server (`server/src/…`) | App (`src/…`) | Test / demo |
|---|---|---|---|
| **1 – Hải** | `auth/`, `sessions/`, `devices/`, `users/` (profile, avatar), `rate-limit/`, `audit/` | `screens/Login, SignUp, Profile, Account, Devices, LockScreen`, `platform/security/` (SecureStore, biometric, khóa thiết bị), `api/auth*`, `contexts/Auth*` | `tests/server/auth*, session*, limits*`, `security-demo/a-, e-, g-` |
| **2 – Bạn** | `messages/`, `events/`, `socket/` (lõi), `files/`, `jobs/`, `crypto-verification/` | `security/` (protocol E2EE), `api/messages*, files*`, `realtime/`, `services/chatMessageService.js`, `screens/Chat, Chats`, `components/Chat*, SafetyNumber*` | `tests/security/*`, `tests/server/message*, files*`, `security-demo/c-, d-` |
| **3 – Quân** | `friends/`, `groups/` (membership, vai trò), `chats/` (tạo direct/group), `policy/` (RBAC middleware), `presence/`, `push/`, `admin/`; `infra/Caddyfile` (TLS) | `screens/Users, Friends, Group*, ChatInfo, Admin, Settings`, `plugins/` (network security, FLAG_SECURE, backup, manifest), `services/notificationService.js`, `platform/integrity/` (root/emulator) | `tests/server/friends*, group*, policy*`, `security-demo/b-, f-`, `docs/security/manifest-checklist.md` |

File dùng chung — **quy tắc**:
- `server/src/app.ts` (đăng ký route): mỗi người chỉ thêm đúng 1 dòng `register(...)` cho module của mình.
- `package.json` / lockfile: **ngày 25/11 sáng Bạn gộp 1 PR thêm toàn bộ dependency** (danh sách ở mục 6). Sau đó ai cần thêm phải nhắn nhóm.
- `contracts/` đã đóng băng v1.0.0. Muốn đổi → báo nhóm, sửa CHANGELOG.
- Mỗi người làm trên nhánh `feat/<lát>-<tên>` (vd `feat/l1-auth`), merge vào `main` qua PR, người khác review nhanh.

---

## 3. Lịch 25–30/11 và điểm phụ thuộc

| Ngày | Hải (Lát 1) | Bạn (Lát 2) | Quân (Lát 3) | Mốc chung tối |
|---|---|---|---|---|
| **25/11** | **Trưa:** `/auth/register`, `/auth/login`, JWT middleware + đăng ký device public key (để 2 lát kia dùng). Chiều: refresh rotation + reuse detection | Sáng: PR dependency. Lõi `src/security/` (X25519/HKDF/AES-GCM/Ed25519, JCS) + test vector; dùng token dev giả tới khi Hải xong middleware | Friends API (request/accept/reject/block) + search; TLS 1.2/1.3 + HSTS trong Caddy; plugin FLAG_SECURE + allowBackup=false | Đăng ký/đăng nhập thật trên emulator qua HTTPS |
| **26/11** | Rate limit (Postgres token bucket) toàn bộ route; Argon2id benchmark; app: SecureStore + biometric lock + logout xóa sạch | Gửi/nhận tin 1-1 E2EE qua REST + socket `inbox.changed`; hiển thị lỗi "Không xác thực được tin nhắn" | Direct/group chat + vai trò owner/admin/member; RBAC middleware; presence qua socket | **Chat 1-1 E2EE chạy giữa 2 máy** |
| **27/11** | Devices/sessions: danh sách, duyệt thiết bị mới, thu hồi → ngắt socket; profile + avatar; audit log | Group E2EE (fanout ≤30 thiết bị); ảnh/tệp mã hóa + xóa EXIF + kiểm tra MIME/magic; lịch sử phân trang | Push FCM (generic); màn hình Admin (audit, khóa user); root/emulator warning; hardening manifest | **Đủ 8 chức năng chạy được** |
| **28/11** | Demo a, e, g chạy được; test auth | Thu hồi/xóa/tự hủy, xóa cả cuộc trò chuyện, tìm kiếm local, safety number; demo c, d | Pinning bản release + demo f (MITM); demo b (IDOR); release APK ký riêng, R8 | **Đóng băng code 22:00** |
| **29/11** | Tổng duyệt lần 1 theo mục 4, sửa lỗi chặn | ← | ← | Quay video dự phòng |
| **30/11** | Tổng duyệt lần 2, luyện trả lời câu hỏi mục 7 | ← | ← | Nộp |

Phụ thuộc cứng: **JWT middleware + device key của Hải (trưa 25/11)** → mọi API của Bạn/Quân; **friends + chats của Quân (sáng 26/11)** → Bạn gửi tin. Trước khi có, dùng seed/fixture, không chờ.

---

## 4. KỊCH BẢN DEMO (mỗi người phải tự chạy được phần của mình)

Chuẩn bị chung: laptop chạy `docker compose up -d`; điện thoại thật + emulator cài **APK release**; 3 tài khoản demo **An, Bình, Chi** (seed); 1 tài khoản **admin**; mở sẵn Adminer/psql để soi DB; Burp/mitmproxy cài sẵn.

### 4.1 Hải — Danh tính & Phiên

| # | Thao tác | Điều phải chỉ ra (bằng chứng) | Cơ chế |
|---|---|---|---|
| H1 | Đăng ký An trên điện thoại, mở DB bảng `users` | Cột mật khẩu dạng `$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>`; đăng ký 2 user cùng mật khẩu → hash khác nhau (salt riêng) | S5 |
| H2 | Đăng nhập; mở jwt.io dán access token | Header `alg: ES256`, payload có `sub, sid, did, exp` (15 phút); không có mật khẩu/role tin được từ client | S4 |
| H3 | **Demo a** — `node security-demo/a-bruteforce/run.js --demo-only` | Sau vài lần sai → HTTP 429 + `Retry-After`, độ trễ tăng 1/2/4/8s; restart server vẫn bị chặn (bucket lưu Postgres); tài khoản thật không bị khóa vĩnh viễn | S9 |
| H4 | **Demo e** — dùng refresh token R1 → nhận R2; dùng lại R1 | Server thu hồi cả "family", socket bị ngắt, access cũ hết dùng được; phiên khác không bị ảnh hưởng | S4 |
| H5 | Đăng nhập Bình trên máy thứ 2 → máy 1 nhận yêu cầu duyệt thiết bị; duyệt; rồi vào **Thiết bị & phiên** thu hồi máy 2 | Máy 2 bị đăng xuất ngay (≤1s), không đọc được tin mới; audit log ghi sự kiện | F8 |
| H6 | Đóng app, mở lại / để nền >30s | Màn hình khóa sinh trắc; bấm Hủy → không thấy nội dung; đổi vân tay trên máy → khóa cũ vô hiệu, phải đăng nhập lại | S7 |
| H7 | **Demo g** — trên emulator root: `adb shell` vào `/data/data/<app>`, xem AsyncStorage/file | Chỉ thấy ciphertext; không có mật khẩu, refresh token, private key ở dạng rõ (nằm trong Keystore qua SecureStore); `adb backup` bị từ chối (allowBackup=false) | S6 |
| H8 | Sửa hồ sơ + avatar, đổi mật khẩu (yêu cầu nhập lại mật khẩu), xóa tài khoản | Chức năng chạy; đổi mật khẩu thu hồi các phiên khác | F1 |

### 4.2 Bạn — Tin nhắn & Mật mã

| # | Thao tác | Điều phải chỉ ra | Cơ chế |
|---|---|---|---|
| B1 | An nhắn Bình "Xin chào" (1-1) — realtime trên 2 máy | Tin đến ngay qua WSS | F3 |
| B2 | Mở DB bảng `messages` | Chỉ có `envelope` gồm `ciphertext`, `nonce`, `tag`, `wraps[]`, `signature` — **không có chữ "Xin chào"**; giải thích: server không có khóa giải mã | S1 |
| B3 | Giải thích sơ đồ 1 tin (mục 5.2): khóa ngẫu nhiên 32 byte → AES-256-GCM → bọc khóa cho từng thiết bị bằng X25519+HKDF → ký Ed25519 | Trả lời được: vì sao mỗi thiết bị một wrap; nonce 12 byte ngẫu nhiên; AAD chứa gì | S1, S2 |
| B4 | **Demo c** — `node security-demo/c-tamper/run.js --demo-only` sửa 1 byte ciphertext trong DB | App Bình hiện **"Không xác thực được tin nhắn"**, không hiển thị nội dung rác | S10 |
| B5 | **Demo d** — gửi lại đúng gói cũ / đổi messageId / đổi counter | Gửi lại y hệt → 200 nhưng không nhân đôi tin; gói bị sửa → 409/chữ ký sai | S10 |
| B6 | Chat nhóm An–Bình–Chi; Quân kick Chi (vai trò admin) rồi An gửi tin mới | Chi không nhận/không tải được tin mới; tin cũ đã có trên máy Chi không thể thu hồi (nói rõ giới hạn) | S1 nhóm |
| B7 | Gửi ảnh có GPS + 1 file PDF | Người nhận mở đúng; file trên server (`objects/*.bin`) mở ra là dữ liệu rác; ảnh nhận được không còn EXIF/GPS; file .exe đổi đuôi thành .jpg bị chặn ở máy gửi | F4, S2 |
| B8 | Thu hồi tin (≤10 phút), xóa phía mình, đặt tin tự hủy 60s | Thu hồi: biến mất ở cả 2 bên; xóa phía mình: chỉ mất ở An; tự hủy: hết hạn thì cả app lẫn server đều từ chối trả nội dung | F7 |
| B9 | Cuộn lịch sử >50 tin, tìm kiếm tin, xóa cả cuộc trò chuyện | Phân trang không thiếu/trùng; tìm kiếm chạy trên máy (server không thấy từ khóa) | F5 |
| B10 | Mở **Safety number** của An và Bình, so sánh/quét QR; đổi khóa thiết bị Bình | Hai bên cùng một dãy số; đổi khóa → banner cảnh báo "khóa đã thay đổi" | S1 (chống tráo khóa) |

### 4.3 Quân — Truy cập & Bảo vệ thiết bị

| # | Thao tác | Điều phải chỉ ra | Cơ chế |
|---|---|---|---|
| Q1 | Tìm Bình theo tên (≥3 ký tự), gửi lời mời, Bình chấp nhận; chặn Chi | Kết quả tìm kiếm không lộ email; chưa là bạn thì không tạo chat được; bị chặn thì không gửi được | F2 |
| Q2 | Bình ra/vào mạng (bật chế độ máy bay) | An thấy Online → Offline trong ≤30s | F6 |
| Q3 | Bình đưa app vào nền / vuốt tắt app, An gửi tin | Bình nhận **push** "Có tin nhắn mới" — không lộ nội dung trên màn hình khóa | F6 |
| Q4 | **Demo b (IDOR)** — `node security-demo/b-idor/run.js --demo-only`: Chi dùng token của mình đọc chat/tin/file của An–Bình bằng ID đoán được | Trả 404/403, không lộ dữ liệu; user thường gọi `/admin/*` → 403 | S8 |
| Q5 | Nhóm: member thử kick người khác / đổi tên → bị từ chối; admin kick member được nhưng không kick được owner | Phân quyền kiểm tra ở **server**, không chỉ ẩn nút trên UI | S8 |
| Q6 | Đăng nhập tài khoản admin → màn hình Admin xem audit log, khóa user Chi | Chi bị đăng xuất ngay; admin **không** đọc được nội dung tin (không có khóa) | S8 |
| Q7 | **Demo f (MITM)** — bật proxy Burp/mitmproxy: bản *control* (không pin) → thấy request; bản *release* (có pin) → kết nối bị chặn `Pin verification failed` cho cả REST và WSS | S3 |
| Q8 | `curl --tlsv1.1` vào gateway → bị từ chối; `curl -I` thấy `Strict-Transport-Security`; gọi `http://` → không phục vụ | S3 |
| Q9 | Chụp màn hình / quay màn hình trong chat; mở Recent Apps | Ảnh chụp đen; Recent Apps bị che | A2 |
| Q10 | Chạy app trên emulator/máy root | Hiện cảnh báo môi trường không an toàn + ghi audit | A2 |
| Q11 | Mở `docs/security/manifest-checklist.md` + merged manifest release | Quyền tối thiểu có lý do; component `exported=false`; không cleartext; R8 bật; APK ký release key | A2 |

### 4.4 Trình tự demo 12–15 phút (cả nhóm)

1. (1') Bạn: giới thiệu kiến trúc + threat model (mục 5).
2. (3') Hải: H1 → H2 → H6 → H3 → H5.
3. (5') Bạn: B1 → B2 → B4 → B6 → B7 → B8 → B10.
4. (4') Quân: Q1 → Q3 → Q4 → Q7 → Q9.
5. (1') Bạn: giới hạn đã biết (mục 7.4) + bảng MASVS.
Các mục còn lại để sẵn, giảng viên hỏi thì mở ra. Có video quay sẵn dự phòng (ghi rõ là quay trước).

---

## 5. Kiến thức chung — AI CŨNG PHẢI NẮM

### 5.1 Kiến trúc
`App Android (Expo/React Native)` ⇄ **HTTPS + WSS (TLS 1.2/1.3, pin SPKI)** ⇄ `Caddy (TLS)` → `Gateway Node.js (Fastify + Socket.IO)` → `PostgreSQL` + `kho file đã mã hóa`. Firebase chỉ dùng để gửi push (FCM), không chứa dữ liệu.
- Server **được tin** để: xác thực tài khoản, phân quyền, chuyển tin, giới hạn tốc độ.
- Server **không được tin** về nội dung: không có khóa giải mã, không đọc được tin/tệp; nếu sửa nội dung thì app phát hiện.

### 5.2 Đường đi một tin nhắn
1. App An tạo khóa nội dung `CK` 32 byte ngẫu nhiên → mã hóa tin bằng **AES-256-GCM** (nonce 12 byte, tag 16 byte, AAD = header tin).
2. Với **mỗi thiết bị** của người nhận (và thiết bị của chính An): `X25519(khóa riêng An, khóa công khai thiết bị)` → **HKDF-SHA256** → khóa bọc → AES-GCM bọc `CK`.
3. Ký toàn bộ gói bằng **Ed25519** (khóa ký của thiết bị An).
4. Gửi qua HTTPS; server kiểm tra chữ ký, quyền, rate limit, lưu gói; báo qua WSS `inbox.changed` (chỉ ID).
5. Bình tải gói → kiểm tra chữ ký → mở wrap của mình → giải mã → kiểm tra tag → mới hiển thị.

### 5.3 Phân biệt khi bị hỏi
- **TLS** bảo vệ trên đường truyền; **E2EE** bảo vệ cả khi dữ liệu nằm trên server.
- **Băm mật khẩu (Argon2id)** là một chiều, chậm có chủ đích; **mã hóa (AES-GCM)** là hai chiều có khóa.
- **AES-GCM tag** chống sửa khi không có khóa; **chữ ký Ed25519** chứng minh *ai* gửi.
- **JWT** ngắn hạn để gọi API; **refresh token** dài hạn, lưu hash ở server, xoay vòng mỗi lần dùng.
- **Android Keystore**: khóa nằm trong vùng phần cứng/TEE, app không xuất được khóa ra; SecureStore dùng khóa Keystore để mã hóa dữ liệu nhỏ (khóa thiết bị, refresh token).

---

## 6. Dependency thêm 1 lần (PR của Bạn, sáng 25/11)

- Server: `argon2`, `jose` (JWT ES256), `@noble/curves` + `@noble/hashes` (kiểm chữ ký), `expo-server-sdk` (push), `node-cron`.
- App: `expo-secure-store`, `expo-local-authentication`, `expo-screen-capture`, `socket.io-client`, `expo-document-picker`, `expo-image-manipulator` (xóa EXIF bằng re-encode), `expo-file-system`, `expo-clipboard`, thư viện phát hiện root/emulator tương thích Expo 58 (Quân chọn, kiểm tra build trước).
- Pin version chính xác, chạy `npm test` + build release xanh trước khi merge.

---

## 7. Chuẩn bị trả lời câu hỏi (mỗi người học phần của mình)

### 7.1 Hải
- *Vì sao Argon2id, không phải SHA-256/MD5/bcrypt?* SHA-256 quá nhanh → dễ brute-force bằng GPU; Argon2id tốn bộ nhớ (64 MB) nên GPU/ASIC khó song song; được OWASP khuyến nghị; salt ngẫu nhiên chống rainbow table.
- *Access token bị lộ thì sao?* Sống 15 phút; mỗi request server còn kiểm tra phiên (sid) đang hoạt động → thu hồi phiên là chặn ngay.
- *Refresh reuse detection là gì?* Mỗi refresh token chỉ dùng 1 lần; nếu token cũ bị dùng lại tức là đã bị đánh cắp → thu hồi cả chuỗi.
- *Sao không khóa tài khoản sau 5 lần sai?* Kẻ xấu có thể cố tình khóa tài khoản người khác (DoS); nhóm dùng rate limit + độ trễ lũy tiến theo IP và theo email.
- *Biometric có lưu vân tay không?* Không; Android chỉ trả kết quả xác thực, app dùng nó để mở khóa key trong Keystore.

### 7.2 Bạn
- *Server có đọc được tin không?* Không — chỉ có ciphertext và khóa công khai; khóa riêng nằm trên thiết bị.
- *Vì sao GCM chứ không CBC?* GCM là mã hóa có xác thực (AEAD): vừa bí mật vừa phát hiện sửa đổi; CBC cần thêm MAC riêng, dễ dính padding oracle.
- *Nonce trùng thì sao?* GCM trùng nonce với cùng khóa là thảm họa (lộ XOR plaintext, giả mạo tag) → mỗi lần mã hóa sinh nonce ngẫu nhiên mới, mỗi tin một khóa `CK` mới.
- *Có forward secrecy không?* **Không** (dùng khóa tĩnh); nếu lộ khóa riêng thiết bị thì đọc được tin cũ gửi tới thiết bị đó. Hướng phát triển: X3DH + Double Ratchet như Signal.
- *Làm sao biết server không tráo khóa công khai?* So safety number/QR ngoài kênh; khóa đổi → cảnh báo.
- *Tin tự hủy có xóa được trên máy người nhận nếu họ chụp màn hình?* Không đảm bảo — đã chặn chụp màn hình trong app nhưng không chống được camera khác; nói rõ giới hạn.

### 7.3 Quân
- *Pinning khác TLS thường thế nào?* TLS thường tin mọi CA trong máy (kẻ tấn công cài CA giả là MITM được); pinning chỉ chấp nhận đúng khóa công khai của server nhóm. Có pin dự phòng để xoay chứng chỉ.
- *Vì sao thư viện pinning JS không đủ?* Đã test: `react-native-ssl-public-key-pinning` không pin WebSocket; nhóm dùng `<pin-set>` của Android Network Security Config áp dụng cho mọi kết nối.
- *RBAC ở đâu?* Kiểm tra ở server cho **mọi** request (vai trò hệ thống user/admin + vai trò nhóm owner/admin/member + quyền sở hữu từng đối tượng) — ẩn nút trên UI chỉ là phụ.
- *IDOR là gì, chống thế nào?* Đổi ID trong request để xem dữ liệu người khác; server luôn kiểm tra người gọi có là thành viên/chủ sở hữu, trả 404 để không lộ đối tượng có tồn tại.
- *FLAG_SECURE / root detection có tuyệt đối không?* Không — là lớp phòng thủ bổ sung; root detection chỉ cảnh báo vì có thể bị bypass.

### 7.4 Giới hạn đã biết (nói trước khi bị hỏi)
Không forward secrecy · server vẫn thấy metadata (ai nhắn ai, lúc nào, kích thước) · không thu hồi được dữ liệu người nhận đã lưu/chụp · mất hết thiết bị = mất lịch sử (không có backup khóa) · push bị chặn nếu người dùng force-stop app · tự host demo trên LAN, không phải hạ tầng production.

---

## 8. Mapping đề cương → người → demo

| Đề cương | Người | Demo |
|---|---|---|
| F1 Tài khoản & hồ sơ | Hải | H1, H8 |
| F2 Tìm kiếm & bạn bè | Quân | Q1 |
| F3 Nhắn tin realtime | Bạn | B1, B6 |
| F4 Ảnh/tệp | Bạn | B7 |
| F5 Lịch sử | Bạn | B9 |
| F6 Online/thông báo | Quân | Q2, Q3 |
| F7 Thu hồi/xóa/tự hủy | Bạn | B8 |
| F8 Thiết bị & phiên | Hải | H5 |
| S1 E2EE | Bạn | B2, B3, B6, B10 |
| S2 AES-256-GCM | Bạn | B3, B7 |
| S3 TLS/HTTPS | Quân | Q7, Q8 |
| S4 JWT & Refresh | Hải | H2, H4 |
| S5 Password Hashing | Hải | H1 |
| S6 Android Keystore | Hải | H7 |
| S7 Biometric | Hải | H6 |
| S8 RBAC | Quân | Q4, Q5, Q6 |
| S9 Rate Limiting | Hải | H3 |
| S10 Message Integrity | Bạn | B4, B5 |
