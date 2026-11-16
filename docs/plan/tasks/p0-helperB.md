# P0 — Helper B (tests/demo): T-04

Repo: D:\ForIntern\WhisperChat-Ctere1. Kế hoạch duyệt: `docs/plan/02-final-plan.md` (đọc mục 5 protocol, 7 bảng T-04/T-09/T-15/T-21, 8 attack kit). Lead = Claude (review). Ghi chú tiếng Việt, code tiếng Anh.

Song song trong CÙNG working tree: Codex làm `contracts/**`, `server/**`, `compose.yaml`, `infra/**`; Helper A làm `src/screens/Users.js`, `src/App.js`, `src/contexts/**`, `app.config.js`, `plugins/**`, root `package.json`/lock. KHÔNG sửa file của họ.

## Quyền sửa file (P0)
- ĐƯỢC: `tests/regression/**`, `tests/contracts/**`, `tests/security/vectors/**`, `security-demo/**`, `docs/plan/03-p0-helperB-notes.md`.
- KHÔNG: root `package.json`/lock (cần dependency → dùng `ask` gửi lead, lead chuyển cho Helper A), `jest.config.js` (nếu cần đổi, ask lead), `src/**`, `server/**`, `contracts/**`.
- KHÔNG git commit/push/branch.
- Nguyên tắc độc lập: bạn là bên kiểm chứng, không viết code sản phẩm.

## Việc
1. **Regression tests cho 4 nợ cũ** (trên code hiện tại, phải FAIL trước khi fix để chứng minh test bắt đúng lỗi — ghi lại output fail):
   - TDZ `handleName` trong `src/screens/Users.js` (render component với mock Firebase/navigation → không ReferenceError). Helper A đang sửa file này song song: chạy test trước khi họ sửa nếu kịp; nếu đã sửa, dùng `git stash`-free cách: so sánh với `git show HEAD:src/screens/Users.js` (chạy test trên bản HEAD copy tạm ngoài repo hoặc mô tả rõ).
   - self-chat `isMessageYourselfExists` so với `2`.
   - outbox `pendingChatMessages` không namespace theo UID → A logout, B login không được gửi pending của A (`src/services/chatMessageService.js`). Test mô tả hành vi mong muốn (sẽ FAIL tới khi T-07/T-08 làm), đánh dấu `test.failing` hoặc skip có lý do.
   - retry `set` vào ID cũ khi lost ACK → không duplicate/không lỗi vô hạn (mô tả kỳ vọng mới theo plan: idempotent 200).
2. **Crypto test vectors** `tests/security/vectors/`: JSON chuẩn từ nguồn chính thức, ghi URL nguồn trong từng file: RFC 7748 X25519, RFC 8032 Ed25519 (test 1–3), RFC 5869 HKDF-SHA256 (case 1–3), NIST/McGrew-Viega AES-256-GCM (≥4 case gồm AAD và tag), SHA-256, RFC 8785 JCS ví dụ. Thêm test negative cases dùng sau: tag lật 1 bit, nonce sai, AAD sai, all-zero X25519 shared secret (low-order point). Viết `tests/security/vectors.test.js` chạy vectors với `@noble/*` — nếu chưa có dependency thì ask lead xin thêm `@noble/ciphers @noble/curves @noble/hashes` (devDependency) và tạm `describe.skip` có ghi chú.
3. **Contract tests khung** `tests/contracts/`: validate `contracts/fixtures/*` theo JSON schema trong `contracts/` (ajv). Contracts đang được Codex viết — viết harness tự phát hiện file, skip nếu chưa có; khi Codex xong lead sẽ báo để chạy thật.
4. **Attack kit khung** `security-demo/`: `README.md` (mục tiêu a–g theo mục 8 plan, prerequisites, guard `--demo-only` + allowlist host, cách reset), mỗi kịch bản một thư mục `a-bruteforce/`…`g-at-rest/` có `README.md` (expected result, assertion, MASVS group) + script Node skeleton (chưa gọi API thật; endpoint lấy từ contract khi có). Không chứa secret.
5. `docs/plan/03-p0-helperB-notes.md`: test plan cho T-09/T-15/T-21 (danh sách test case theo endpoint/ma trận quyền mục 3 & 6), những gì cần từ Codex/A.

## Evidence khi xong
Output thật `npm test` (ghi số pass/fail/skip, test nào expected-fail), danh sách vectors + nguồn, file tạo. Không sửa ngoài vùng cho phép.
