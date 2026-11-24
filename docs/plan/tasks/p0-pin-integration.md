# P0 — Hoàn tất tích hợp CA/pins thật vào app (tiếp quản từ Codex hết quota)

Repo: D:\ForIntern\WhisperChat-Ctere1. Lead (review). Ghi chú tiếng Việt.

## Trạng thái hiện tại (Codex làm dở)
- `plugins/withNetworkSecurity.js` đã được sửa để đọc `infra/public/ca.crt` + `infra/public/pins.json`; CA spike `plugins/certs/ca.crt` đã xóa; `app.config.js` đang được sửa. KIỂM TRA LẠI và hoàn thiện, không viết lại từ đầu nếu đã đúng.
- Gateway thật đang chạy bằng docker compose: `https://<host>:8443/v1/health` → `{"status":"ready"}`. Server cert SAN: whisperchat.local, whisperchat.lan, localhost, 127.0.0.1, 10.0.2.2, 192.168.52.74. Pins trong `infra/public/pins.json`.

## Quyền sửa file
CHỈ: `plugins/withNetworkSecurity.js`, `app.config.js`, `src/dev/netSecSpike.js`, `docs/plan/03-p0-helperA-notes.md` (thêm mục kết quả cuối). Không git commit. Không xóa dữ liệu ngoài repo (ổ D: chỉ còn ~3.8 GB, C: ~20 GB — thiếu chỗ thì `ask` lead). Không chạy server phụ nào trên cổng 8443.

## Việc
1. Plugin: đọc ca.crt + pins.json (host, pins, expiration); thiếu/sai file → prebuild FAIL rõ ràng. Domains: whisperchat.local, 10.0.2.2, 192.168.52.74, override bằng `EXPO_PUBLIC_GATEWAY_HOST`; không includeSubdomains cho IP. app.config.js không còn pin/CA spike.
2. `src/dev/netSecSpike.js`: trỏ tới `https://10.0.2.2:8443/v1/health` (bỏ các path spike cũ không tồn tại trên gateway; WSS chưa test vì socket cần auth — ghi chú).
3. Build: JDK 17 (`C:\Program Files\Java\jdk-17`), ANDROID_HOME `C:\Users\DELL\AppData\Local\Android\Sdk`; `npx expo prebuild --platform android --clean` rồi `android\gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64`. Xem `docs/BUILD-ANDROID.md`.
4. Emulator `Pixel_8_Pro` (khởi động nếu chưa chạy). Với `EXPO_PUBLIC_RUN_PIN_TEST=true`: pin đúng → log health ready; build thêm 1 bản với pins sai (vd tạm truyền pin giả qua env/option, KHÔNG sửa pins.json) → `SSLHandshakeException: Pin verification failed`. Trích logcat.
5. `npm test` + `npm run lint` pass.

## Done khi
worker_done kèm: exit code prebuild/build, trích logcat pin đúng/sai, kết quả npm test/lint, danh sách file đã sửa.
