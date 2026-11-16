# Codex phản biện vòng 2 — R1–R7

> Cập nhật sau quyết định user và `01d-lead-review-2.md`: phần R1–R7 bên dưới giữ làm lịch sử phản biện ban đầu, không phải kế hoạch triển khai hiện hành. Bản có hiệu lực là `02-final-plan.md`: Fastify + Socket.IO/WSS + PostgreSQL + local ciphertext store, bỏ Firebase khỏi auth/data; E2EE cả nhóm và 1-1, nhóm ≤10 người × ≤3 device; 12 ngày code 17–28/11 và rehearsal 29–30/11. Vì vậy các đề xuất cũ “chỉ 1-1”, “20 ngày”, “Firebase custom-token/lease/Rules”, “RTDB/heartbeat presence” và SQLCipher mặc định đã bị thay thế. Firebase chỉ còn tùy chọn cho push; không còn yêu cầu service account để chạy phần MUST.

### Phản hồi cập nhật D1–D5

- **D1: đồng ý kiến trúc mới**, chọn PostgreSQL/Prisma, Socket.IO chỉ phát event ID rồi REST lấy ciphertext. Loại hai vòng refresh và hai policy engine là lợi ích kỹ thuật thực; tuy nhiên handshake auth không tự kiểm từng packet hoặc token hết hạn, socket delivery không tự bền vững, và REST pinning không tự chứng minh WSS đã pin. Kế hoạch cuối bổ sung timer expiry, DB authorization, transactional outbox/reconnect cursor và test riêng cả REST/WSS/polling; không tuyên bố “toàn bộ traffic” nếu chưa đo hoặc nếu thêm FCM.
- **D2: đồng ý group E2EE và direct dùng một protocol**, content key mới mỗi message, tối đa 30 wraps, không Sender Keys trong deadline này. So với Sender Keys, fanout tốn CPU/băng thông hơn nhưng giảm state/rotation phức tạp; phải benchmark 30-device và kiểm membership/roster revision nguyên tử. Owner/admin/member được kiểm phía server; thiết bị/thành viên mới không có history cũ.
- **D3: đồng ý local persistent ciphertext store**, cap 10 MiB nếu benchmark đạt, nếu không 5 MiB; không giữ đề xuất fallback 2 MiB ở phản biện cũ. Nếu cả 5 MiB chưa đạt, báo checkpoint thất bại và cần sửa implementation, không tự giảm tiếp yêu cầu đã chốt.
- **D4: nhận deadline bắt buộc**, checkpoint 18/21/24/27, không viện lại timeline 20 ngày. Hoãn SQLCipher; outbox/secrets mã hóa vẫn MUST, encrypted full history cache SHOULD. Attack kit a–f có MITM nên pinning đủ để kiểm chứng f phải nằm ở MUST; chỉ video trình diễn/phần mở rộng pinning mới SHOULD. Notifications khi app bị kill chỉ SHOULD theo lead, phải công bố giới hạn nếu chưa làm được.
- **D5: đồng ý ownership Codex / Helper A / Helper B**, không tạo worker trong lượt tài liệu. Khóa contract ngày 17/11, một owner cho mỗi file, dành người nhóm thật kiểm integration và thiết bị; final plan liệt kê file, dependency, acceptance và handoff rõ.

Không phản đối quyết định bỏ Firebase. Bất đồng còn lại là cách diễn đạt assurance và phân tầng MITM/pinning nêu trên, cùng rủi ro lịch triển khai; chúng được ghi ở cuối kế hoạch, không đảo lại quyết định user.

Ngày 16/11/2026. Đầu vào: `01-codex-survey.md` và `01b-lead-review.md`. Không sửa source; kết quả hợp nhất tại `02-final-plan.md`. Các đề xuất dưới đây là thiết kế cần lead/user chốt, chưa phải tính năng đã triển khai hoặc kiểm chứng trên thiết bị.

## R1 — Gateway Node tự viết

**Đồng ý về hướng chính:** TypeScript/Fastify, Argon2id, JWT ES256, opaque refresh rotation, RBAC và rate limiting thực sự do nhóm viết là phù hợp mục tiêu môn học hơn Functions. Bỏ email/password Firebase cho bản secure; gateway là nguồn tài khoản duy nhất, Firebase Auth chỉ cấp identity phục vụ listener. Không giữ hai đường đăng nhập có thể sinh quyền khác nhau. Dữ liệu demo cũ reset có chủ đích sau khi được duyệt; không tự chuyển hash Firebase sang Argon2id hoặc tạo account theo email chưa xác minh.

**Không đồng ý rằng custom token + `sessions.active` tự nó đã kín.** Firebase custom token là vé đăng nhập, không phải access JWT của gateway; sau exchange SDK có ID token và refresh token riêng. Access JWT hết hạn không làm phiên Firebase hết hạn, còn role trong JWT có thể cũ. Thiết kế phải có:

- JWT gateway 15 phút, refresh family tối đa 30 ngày; mỗi API kiểm session/device/account hiện tại, không chỉ chữ ký JWT. Endpoint `/auth/firebase-token` chỉ chấp nhận gateway JWT hợp lệ và session đang hoạt động, không nhận Firebase ID token làm vé cấp lại quyền gateway.
- Client giữ Firebase Auth **in-memory**; cold start dùng refresh gateway đã được Keystore bảo vệ rồi xin custom token mới. Firebase SDK vẫn có thể tự refresh trong RAM; Rules kiểm thêm `realtimeUntil` do gateway đặt, tối đa đến thời điểm access JWT hiện tại hết hạn. SDK refresh không tự kéo dài lease đó. Gateway refresh thành công mới gia hạn lease; khi lease hết, subscribe lại sau renew, không fallback Rules rộng.
- Một Firestore transaction là nguồn canonical cho session revoke/account disable; mọi API kiểm nguồn đó. Revoke device chặn session của device đó và key roster; Firebase token còn hạn cũng bị Rules từ chối. Ghi active/lease chỉ bằng server. Role admin lấy từ account authoritative, không tin claim role cũ trong Firebase token.

**Điều chỉnh thiết kế đề xuất:** Firestore `onSnapshot` chỉ nhận inbox event `{chatId,messageId,eventType,seq}` của thiết bị; ciphertext/history tải qua gateway đã kiểm quyền. Canonical messages không cho SDK client đọc/ghi trực tiếp. Đây vẫn là realtime, có thêm một HTTP request khi event đến, nhưng giải quyết nhất quán revoke, expiry và thiết bị mới không đọc lịch sử cũ; tránh đánh đồng Rules với bộ lọc truy vấn. Nếu lead muốn nhận ciphertext trực tiếp từ Firestore, cần thêm spike riêng chứng minh query authorization/expiry/device audience và chấp nhận giới hạn retention — không xem hai phương án có cùng công sức.

**Chi phí Rules:** mỗi event listener đánh giá session bằng `get()` có đọc phụ thuộc tính quota/billing; có cache trong một lần đánh giá không có nghĩa miễn phí cho toàn vòng đời listener. Không nhân máy móc “mỗi message đúng một read”, phải đo initial/reconnect/update/revoke. Một listener theo device, limit 50, một session lookup trong predicate; chi phí vẫn tăng theo fanout tối đa 6 device. [Firebase billing](https://firebase.google.com/docs/firestore/pricing), [Rules limits](https://firebase.google.com/docs/firestore/security/rules-conditions).

**Rủi ro mới cần sửa nhận định ngân sách:** Admin SDK không phải cách vượt yêu cầu billing của sản phẩm. Firebase Storage hiện có yêu cầu Blaze theo thay đổi bucket/access; bỏ Functions không chứng minh toàn dự án miễn phí. Chọn mặc định demo gateway local + kho ciphertext filesystem persistent trên máy demo; dùng Firebase Storage sau khi xác nhận plan, vẫn qua gateway, deny client trực tiếp. Render free có sleep/ephemeral filesystem nên không phù hợp để hứa cron và lưu file bền vững. [Storage requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024?hl=en), [Render free](https://render.com/docs/free).

Pinning gateway trở nên dễ khoanh phạm vi hơn, nhưng vẫn **M**, không mặc định S: cần native network stack thật trên Expo 58/New Architecture, trust chain, backup pin/rotation và test release. Pin một fetch wrapper không tự pin SDK Firebase. [Firebase custom token semantics](https://firebase.google.com/docs/auth/admin/create-custom-tokens).

## R2 — Noble cho primitives

**Đồng ý ưu tiên** `@noble/ciphers` AES-GCM + `@noble/curves` X25519/Ed25519 + `@noble/hashes` HKDF/SHA-256. Module protocol thuần JS dùng cùng code ở Jest/Hermes; source `src/App.js:1` đã import `react-native-get-random-values`, nhưng phải kiểm runtime CSPRNG hoạt động trước keygen, không fallback Math.random. Pin package versions sau Metro/ESM spike. [Noble ciphers](https://github.com/paulmillr/noble-ciphers).

**Không đồng ý lý do “native AES không test vectors được”:** có thể chạy instrumentation và reference vectors cho native; khó hơn CI unit nhưng không bất khả thi. Expo 58 có AES-GCM; việc chưa có dependency không phải giới hạn kỹ thuật. Chọn noble vì giảm integration matrix, không vì native không xác minh được. Audit primitives cũng không làm giao thức tự thiết kế thành audited protocol.

**Hiệu năng chưa đo:** không có benchmark Hermes trên máy đích trong lượt này. Gate P0/P3: 1/5/10 MiB, encrypt/decrypt p95, JS stall và peak RAM trên APK release, file 10 MiB mục tiêu mỗi chiều ≤3 giây và peak RSS tăng ≤128 MiB trên thiết bị tham chiếu được ghi tên. Nếu fail, MVP cap 2 MiB và đánh giá native/streaming sau; không tự tăng thread/crypto chunking thiếu thiết kế. Dùng bytes, tránh base64 file lớn; key vẫn có lúc ở JS heap, root khi unlock có thể đọc — không gọi non-exportable.

## R3 — E2EE MVP hẹp

**Đồng ý:** chỉ 1-1, tối đa 3 device/user, static X25519/HKDF/AES-256-GCM/Ed25519, QR + key-change warning, không group, không history transfer, không key transparency, không FS. Double Ratchet chỉ là hướng phát triển; “rút gọn” sẽ làm mơ hồ assurance và tốn review ngoài timeline.

**Làm rõ hai điều:** “thiết bị mới chỉ thấy tin từ lúc enroll” là policy của đồ án, không lấy so sánh Signal làm specification; eligibility phải là device nằm trong recipient roster **tại lúc message commit**, không chỉ timestamp phía client. Không cấp envelope lịch sử cho device mới, gateway kiểm audience khi đọc, inbox chỉ phát cho roster đó. Logout/login cùng device có thể đọc lại ciphertext đã từng được cấp nếu key vẫn giữ theo policy; reinstall hoặc reset key là device mới.

**Rủi ro:** mất cả device/key đồng nghĩa mất lịch sử; một device private key tĩnh bị lộ có thể mở các envelope cũ dành cho nó, nên không forward secrecy. Device mới phải được existing trusted device phê duyệt hoặc recovery ceremony đã thông báo mất trust; self-sign bundle không ngăn server thay cả identity. Device roster revision được kiểm trong transaction send để không gửi cho device vừa revoke.

## R4 — Mục tiêu 3–4 tuần

**Đồng ý có điều kiện, không nhận là cam kết chắc chắn.** Đặt mốc 20 ngày làm việc, ba luồng triển khai có người tích hợp và thiết bị thật; cần chốt scope/contracts ngay P0. Agent song song giúp UI/tests/backend nhưng không loại bỏ thời gian benchmark, release/network setup và review protocol/session. Nếu một người tích hợp hoặc P0 chưa build được thì 3–4 tuần là target cần rebaseline.

Tách crypto vector spike, pinning spike, schema/API contract từ P0; làm push credentials và app-lock sớm. P4 không dồn cả SQLCipher/file/recall vào cuối: outbox mã hóa ở P1, SQLCipher spike P0 rồi repository ở P2. Checkpoint ngày 3/7/10/14/18/20; nếu gate trượt hai ngày phải giảm optional bonus trước, không bỏ integrity/authz/revoke rồi vẫn tuyên bố đạt đủ yêu cầu.

**Rủi ro mới:** tự viết auth thêm recovery/enumeration/DoS/session race; giới hạn 3 device cần UI revoke khi đầy; Functions→gateway thêm vận hành worker/persistence. Owner Gemini/helper chỉ là đề xuất phân công sau, không giả định agent đã chạy. TOTP, root detection, obfuscation nâng cao, ratchet và transparency hoãn; pinning giữ làm demo cần checkpoint khả thi sớm.

## R5 — Attack demo kit là deliverable chính

**Đồng ý**, thêm expected result/machine assertion, fixture cô lập, reset và artifact đã redaction; mapping MASVS cho mobile và nêu ASVS liên quan backend, không gọi backend rate limit là chứng nhận MASVS. Script admin chỉ chạy khi project ID demo allowlisted và confirmation flag, key qua environment/ADC; tuyệt đối không nhúng key vào APK hoặc repo.

**Chỉnh nghĩa replay:** retry cùng ID + cùng envelope phải trả kết quả cũ và không phát push/tăng unread lần hai, không nhất thiết trả lỗi. Replay đổi chat/id/device/counter phải 409/403/invalid signature; reuse refresh phải revoke family trong transaction. Refresh song song phải có client single-flight và test: lựa chọn MVP strict rotation, mất response/refresh đôi có thể yêu cầu login lại; không thêm “grace window” vô hạn để demo giả an toàn.

Tamper test phải phân biệt app không mở được nội dung với “biết chắc ai đã sửa”; UI “Không xác thực được tin nhắn”, chi tiết debug chỉ trong fixture. Dump at-rest thực hiện sau lock/kill app, không cam kết root attacker không đọc được RAM của app đang unlock. Pinning test có control TLS không pin và chứng minh proxy CA đã trusted trong lab, nếu không TLS mặc định cũng chặn và không chứng minh pinning.

## R6 — Presence/push không Functions

**Đồng ý** push từ gateway; ghi durable push job cùng transaction commit message rồi worker xử lý receipt/retry thay vì gọi Expo Push trước commit. Push payload generic, token bound session/device, at-least-once và client dedup; gateway restart không làm mất notification chưa gửi. [Expo sending](https://docs.expo.dev/push-notifications/sending-notifications/).

**Đồng ý cron chỉ là cleanup, không là security boundary.** Mỗi GET/download kiểm expiresAt bằng server clock và deny đã hết hạn ngay cả cron chết; client timer xóa local plaintext/key/cache khi online/offline với giới hạn clock trust được công bố. Job khởi động phải catch-up, có lease/idempotency, không cần Functions; process free-tier ngủ thì cleanup vật lý chậm.

**Phản biện RTDB mặc định trong MVP 20 ngày:** RTDB Rules dùng root/data của RTDB, không đọc Firestore sessions; mirror active/lease/friends sang RTDB tạo vấn đề hai datastore không atomic, revoke có cửa sổ lỗi. Đề xuất **presence heartbeat qua gateway** mỗi 20 giây khi foreground, offline sau 60 giây theo server; đọc chỉ friends, rõ đây là trạng thái gần đúng. Đủ yêu cầu online/offline và cùng session boundary, không cần RTDB/databaseURL. Nếu lead bắt buộc `onDisconnect`, thêm task riêng mirror lease ≤60 giây, revoke retry/outbox và RTDB rules tests, ghi nhận bounded stale metadata; không hứa revoke metadata tức thì giữa hai store. [RTDB rules conditions](https://firebase.google.com/docs/database/security/rules-conditions).

## R7 — Nợ kỹ thuật P0/P1

**Đồng ý hoàn toàn**, không để unit test xanh che lỗi Users. P0 sửa TDZ `src/screens/Users.js:107/115`, boolean so với 2 ở dòng 81, outbox bind uid/device tại `src/services/chatMessageService.js:18/64`, logout purge; test không gửi pending của A dưới identity B. P0 thêm test idempotency ở service hiện tại; P1 gateway thành chủ sở hữu gửi, không nới Rules cho client overwrite để “sửa retry”.

**Rủi ro migration:** không auto-flush outbox plaintext cũ sau đổi auth/schema. Mặc định quarantine/xóa dữ liệu demo cũ sau quyết định user; secure schema mới fail closed với schema cũ. Regression tests bao gồm lost ACK, concurrent retry, crash giữa enqueue/commit/ack và account switch.

## Điểm cần lead chốt còn lại

1. Duyệt realtime inbox ID-only + GET gateway thay vì ciphertext trực tiếp Firestore, để quản lý expiry/audience/revoke nhất quán.
2. Chọn gateway heartbeat cho MVP; RTDB onDisconnect là mở rộng có chi phí đồng bộ revoke, không tự miễn phí về kỹ thuật.
3. Chốt local persistent ciphertext store cho demo không billing, hoặc xác nhận Firebase Storage Blaze; không hứa Render free + disk/cron bền vững.
4. Công nhận 20 ngày là target có gate và điều kiện nhân lực; pinning là M và noble 10 MiB phải benchmark trước khi cam kết.

Không còn bất đồng về bỏ Firebase password Auth, tự viết gateway auth, primitive noble, 1-1/3-device/no-FS/no-history-transfer, không Double Ratchet rút gọn, attack kit bắt buộc và sửa nợ P0/P1. `02-final-plan.md` chọn mặc định cho bốn điểm trên để implementation có thể bắt đầu sau review; chúng không bị che dưới nhãn “đã đồng thuận”.
