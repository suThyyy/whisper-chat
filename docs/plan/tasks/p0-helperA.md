# P0 — Helper A (client/Android): T-03

Repo: D:\ForIntern\WhisperChat-Ctere1 (React Native 0.88 / Expo SDK 58, JS). Kế hoạch duyệt: `docs/plan/02-final-plan.md` (đọc mục 1, 2 "TLS, pinning", 3 "Enrollment và Android storage", 7 bảng task T-03). Lead (review). Ghi chú tiếng Việt, code tiếng Anh.

Song song trong CÙNG working tree: Codex làm `contracts/**`, `server/**`, `compose.yaml`, `infra/**`; Helper B làm `tests/regression/**`, `tests/contracts/**`, `tests/security/**`, `security-demo/**`. KHÔNG sửa file của họ.

## Quyền sửa file (P0)
- ĐƯỢC: `src/screens/Users.js`, `src/contexts/**`, `src/App.js`, `app.config.js`, `plugins/**`, root `package.json` + `package-lock.json` (chỉ bạn sửa trong P0), `eas.json`, `android/` (sinh bởi prebuild, đang gitignore), `docs/plan/03-p0-helperA-notes.md`.
- KHÔNG: `src/services/**`, `src/config/**`, `server/**`, `contracts/**`, `tests/**`.
- KHÔNG git commit/push/branch.
- Helper B có thể nhờ lead chuyển yêu cầu thêm devDependency (vd `@noble/*`) — lead sẽ gửi cho bạn; bạn là người duy nhất sửa root package.json.

## Việc
1. **Bug fix**: `src/screens/Users.js` — `handleName` dùng trong dependency array (dòng ~107) trước khi khai báo (dòng ~115) → TDZ ReferenceError; `isMessageYourselfExists` là boolean nhưng so với `2` (dòng ~71/81) → nhánh tái dùng self-chat không chạy. Sửa tối thiểu, không đổi hành vi khác. Báo cho lead dòng nào đổi để Helper B viết regression test tương ứng.
2. **Android build**: tạo native project (`npx expo prebuild --platform android`), build được debug và release APK cục bộ (Gradle; chọn JDK tương thích — máy đang có Java 25, có thể cần JDK 17; ghi rõ đã dùng gì). Cài lên emulator (và ghi lệnh để user cài lên máy thật qua adb). Đảm bảo các thay đổi native nằm trong `app.config.js`/`plugins/` (config plugins), không sửa tay `android/` vì nó gitignore.
3. **Network security config qua config plugin** (`plugins/withNetworkSecurity.js`): cấm cleartext; trust CA riêng của nhóm CHỈ cho domain gateway (domain-config), không trust user CA ở bản release. CA cert công khai sẽ ở `infra/public/ca.crt` do Codex tạo — nếu chưa có, dùng CA tạm tự tạo trong thư mục scratch ngoài repo cho spike và ghi chú.
4. **Pinning spike (quan trọng nhất, gate 18/11)**: thử `react-native-ssl-public-key-pinning` (hoặc phương án khác) trên Expo 58 / New Architecture. Phải kiểm RIÊNG: (a) fetch HTTPS REST, (b) WebSocket WSS (socket.io-client websocket-only hoặc WebSocket thuần), (c) upload/download binary. Với mỗi cái: pin đúng → kết nối OK; pin sai → bị chặn. Dùng server HTTPS+WSS tạm (tự viết script Node nhỏ trong thư mục scratch NGOÀI repo, hoặc dùng gateway của Codex nếu đã chạy). Nếu thư viện không pin được WSS, đề xuất phương án native (OkHttp CertificatePinner qua config plugin / custom module) và đánh giá công sức.
5. Ghi kết quả vào `docs/plan/03-p0-helperA-notes.md`: JDK/Gradle/SDK dùng, lệnh build, kích thước APK, kết quả pinning bảng (REST/WSS/binary × pin đúng/sai), rủi ro.

## Evidence khi xong
Output thật: `npm run lint`, `npm test`, lệnh gradle build release (exit code), `adb install` lên emulator, log/ảnh chụp minh chứng pinning đúng/sai cho từng transport. Fail thì báo đúng như vậy. Liệt kê dependency đã thêm (version pin cụ thể).
