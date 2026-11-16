# P0 Helper B (T-04) — ghi chú, bằng chứng và test plan T-09/T-15/T-21

Ngày: 16/11/2026. Người viết: Helper B (Claude worker, tests/demo). Phạm vi sửa: `tests/regression/**`, `tests/contracts/**`, `tests/security/**` (vectors + `vectors.test.js`), `security-demo/**`, file này. Không sửa `src/**`, `server/**`, `contracts/**`, root `package.json`/lock, `jest.config.js`. Không commit.

## 1. Kết quả `npm test`

### Lần chạy cuối (16/11, sau khi Helper A cài `@noble/*` 2.4.0 + `ajv` 8.20.0 / `ajv-formats` 3 và sửa `jest.config.js`)

```
Test Suites: 9 passed, 9 total
Tests:       240 passed, 240 total   (0 fail, 0 skip)
```

| Suite | Pass | Ghi chú |
|---|---|---|
| `src/components/__tests__/ContactRow.test.js` | 1 | baseline cũ |
| `src/utils/__tests__/chat.test.js` | 8 | baseline cũ (tổng baseline 9 giữ nguyên) |
| `tests/regression/users-screen.test.js` | 5 | nợ #1, #2 — pass trên bản đã sửa của A |
| `tests/regression/outbox-account-switch.test.js` | 4 | 3 case `test.failing` = **expected-fail** (nợ #3) + 1 control |
| `tests/regression/retry-lost-ack.test.js` | 3 | 2 case `test.failing` = **expected-fail** (nợ #4) + 1 control |
| `tests/security/vectors.test.js` | 108 | 72 (vector files + JCS + provider node:crypto) + **36 provider `@noble` chạy thật, không skip** |
| `tests/security/noble-import.test.js` | 1 | smoke import ESM do Helper A thêm (không phải file của B) |
| `tests/contracts/contracts.test.js` | 96 | contracts v1.0.0; Ajv 2020 lấy trực tiếp từ devDependency `ajv@^8` (đã bỏ workaround transitive) |
| `security-demo/__tests__/guard.test.js` | 14 | guard/redaction/layout attack kit |

Lần chạy trước khi có dependency: 8 suites, 203 pass, 1 skip (`@noble` placeholder).

`test.failing` pass nghĩa là assertion bên trong **đang fail đúng như dự kiến**. Khi T-07/T-08/T-13 sửa xong, Jest báo "failing test passed" → đổi `test.failing` thành `test` (biến `expectedFail` ở đầu file).

## 2. Bằng chứng "FAIL trước fix" cho 4 nợ cũ

### #1 TDZ `handleName` và #2 self-chat (`src/screens/Users.js`)

Helper A đã sửa file trong lúc viết test, nên tái hiện trên bản HEAD `24a1900` qua `git show` (bản sao tạm, xóa sau khi chạy):

```sh
node tests/regression/tools/make-head-baseline.js        # ghi tests/regression/.baseline/Users.head.js
WC_USERS_SCREEN=../../tests/regression/.baseline/Users.head.js npx jest tests/regression/users-screen
rm -rf tests/regression/.baseline
```

Output trên HEAD:

```
● #1 static: no const/let binding is read at render time before its declaration
    + "handleName read at line 107 before declaration at line 115",
● #2 opens the existing self-chat instead of creating a duplicate
    Expected number of calls: 0
    Received number of calls: 1          (createDirectChat bị gọi → tạo self-chat trùng)
Tests: 2 failed, 3 passed, 5 total
```

Trên working tree (bản A sửa): 5/5 pass.

**Phát hiện quan trọng:** render test thuần (`render(<Users />)` không throw) **pass cả trên HEAD** vì Jest dùng `babel-preset-expo` hạ `const` thành `var`, TDZ không xảy ra trong Jest. Vì vậy thêm kiểm tĩnh `helpers/tdzCheck.js` (Babel AST: tham chiếu const/let đọc đồng bộ trước khai báo trong cùng function) — đây mới là test bắt đúng lỗi. Nếu A muốn kiểm runtime TDZ thật cần chạy trên Hermes/thiết bị.

### #3 outbox không namespace theo UID (`src/services/chatMessageService.js`)

`WC_SHOW_EXPECTED_FAILURES=1 npx jest tests/regression/outbox tests/regression/retry`:

```
● B must not see A pending messages after account switch
    Received array: [{"_id":"msg-a-1", "text":"A-private-draft-7c1e", ...}]
● B flush must not send A pending message as B
    Received array: [{"_id":"msg-a-1","senderId":"uid-b","text":"A-private-draft-7c1e","user":{"_id":"b@example.com",...}}]
● outbox at rest must not contain plaintext
    Received string: "{\"chat-ab\":[{\"_id\":\"msg-a-1\",\"text\":\"A-private-draft-7c1e\",...}]}"
```

→ B gửi tin nháp của A **dưới danh nghĩa B**, và outbox lưu plaintext. Owner: T-07 (A) + T-08/T-17 (C).

### #4 retry `set` vào ID cũ khi mất ACK

```
● retry of an already-committed message is idempotent: unread stays 1
    Expected: 1  Received: 2               (unreadCount người nhận bị cộng 2 lần)
● server rejecting overwrite of an existing ID must not leave the message stuck forever
    Expected length: 0  Received length: 1 (sau 3 lần flush message vẫn kẹt pending)
```

Kỳ vọng mới (plan §5): cùng `messageId` + cùng `envelopeHash` → 200 idempotent, 1 row/event/unread; khác hash → 409; client coi idempotent 200 là delivered. Owner: T-13 (server), T-08 (client).

Lưu ý: test #3/#4 viết trên API service Firebase hiện tại; khi T-08 thay bằng `src/api` + outbox mã hóa, C cung cấp adapter, B viết lại theo API mới, giữ nguyên kịch bản.

## 3. Crypto test vectors (`tests/security/vectors/`)

Nguồn tải trực tiếp từ rfc-editor.org / csrc (không chép từ trí nhớ); mọi vector được xác minh lại bằng `node:crypto` (OpenSSL) trong `vectors.test.js`.

| File | Nội dung | Nguồn |
|---|---|---|
| `x25519.rfc7748.json` | 2 function vectors, iterated 1 và 1000 lần, DH Alice/Bob | https://www.rfc-editor.org/rfc/rfc7748#section-5.2, #section-6.1 |
| `ed25519.rfc8032.json` | TEST 1–3 (pubkey, sign, verify) | https://www.rfc-editor.org/rfc/rfc8032#section-7.1 |
| `hkdf-sha256.rfc5869.json` | A.1–A.3 (PRK + OKM) | https://www.rfc-editor.org/rfc/rfc5869#appendix-A |
| `aes-256-gcm.mcgrew-viega.json` | Test Case 13–16 (TC16 có AAD, plaintext 60 byte) | McGrew–Viega GCM spec, csrc.nist.gov (URL trong file) |
| `sha256.fips180.json` | "abc", two-block, empty | NIST FIPS 180 examples, CAVP ShortMsg |
| `jcs.rfc8785.json` | ví dụ 3.2.2→3.2.4 (bytes chính xác), sorting 3.2.3, 23 number samples Appendix B, reject NaN/Infinity/lone surrogate | https://www.rfc-editor.org/rfc/rfc8785 |
| `negative-cases.json` | GCM: lật bit tag (đầu/cuối), ciphertext, nonce sai, AAD sai, thiếu AAD, tag cắt 12 byte, key sai; Ed25519: lật bit sig/message, sai pubkey, sig cắt; X25519: 7 điểm low-order (0, 1, 2 điểm order 8, p−1, p, p+1) → throw hoặc all-zero | RFC 7748 §6.1/§7, cr.yp.to/ecdh.html#validate |
| `jcs-reference.js` | Oracle JCS cho test (port RFC 8785 App. A), không phải code sản phẩm | |

Provider trong `vectors.test.js`: `node:crypto` (luôn chạy), `@noble/*` 2.4.0 (đang chạy, 36/36 pass), `product` (TODO T-12: adapter tới `src/security/*` của C + golden envelope `wc-e2ee-v1` chạy cả Node và Hermes).

## 4. Contract tests (`tests/contracts/`)

- `contracts.test.js` tự phát hiện `contracts/*.schema.json`, `openapi.yaml`, `fixtures/*.json`; thiếu thì skip có lý do.
- `fixture-map.json`: map 12 fixture → schema ref + `schemaValid` + `policyReject`. Fixture mới chưa khai báo làm test FAIL (buộc cập nhật map). Hai fixture là **policy-only**: `direct-create.invalid-self.json` (schema hợp lệ, server phải từ chối), `message-expiry.invalid-too-soon.json` (fragment, không phải payload đầy đủ) → chuyển sang server tests T-09/T-15.
- Kiểm: schema validity (Ajv 2020-12 + formats, resolve `./e2ee-envelope.schema.json` từ OpenAPI), fixture không chứa secret (PEM, JWT, field token/key, Google API key, email domain ngoài `.invalid`), không trùng key, OpenAPI 3.1 phủ 53 endpoint của plan §6 (`expected-endpoints.json`, deviation `POST /me/delete` đã duyệt), mọi operation có `x-rate-limit`, chỉ health/auth public + enroll được `security: []`, admin không public.
- Ajv 8.20.0 + ajv-formats 3 là devDependency trực tiếp (Helper A cài 16/11); workaround transitive đã gỡ.

## 5. Attack kit (`security-demo/`)

`README.md` (mục tiêu a–g, prerequisites, guard, reset, evidence), `lib/guard.js` (`--demo-only`, HTTPS bắt buộc, allowlist host `WC_DEMO_ALLOWED_HOSTS`, destructive cần `--confirm-db` = `WC_DEMO_DATABASE_ID`, `--dry-run`, redaction), 7 thư mục `a-bruteforce` … `g-at-rest` mỗi thư mục có `README.md` (prerequisites, bước, expected, machine assertions, MASVS group) + `run.js` skeleton (exit 3 "not implemented" tới T-21). Không chứa secret (có test kiểm).

## 6. Test plan T-09 (auth/session/limits, 20–21/11)

Môi trường: PostgreSQL test DB riêng (container), Fastify `inject` (hoặc supertest trên HTTP adapter), không dùng DB demo/prod. File: `tests/server/auth*`, `session*`, `limits*`.

| Endpoint | Test case |
|---|---|
| `POST /auth/register` | 201 với fixture hợp lệ; field `role` → 400; password <12 / >128 → 400; không truncate (password 128 ký tự login đúng, 127 ký tự đầu sai); email trùng → 409 generic; body >16 KiB → 413 trước Argon; challenge proof sai/đã dùng/hết hạn → 400/401; PHC Argon2id `m=65536,t=3,p=1`, salt khác nhau cho cùng password; DB không có plaintext |
| `POST /auth/challenge` | one-use, TTL 60s, purpose ràng buộc (login challenge không dùng cho enroll) |
| `POST /auth/login` | sai email và sai password trả cùng body/thời gian xấp xỉ (dummy hash); device mới → pending handle, không chat token; limiter 10/10phút/IP và 5/15phút/HMAC(email) → 429 + Retry-After; backoff 1/2/4/8/16/30s; restart gateway không reset bucket; account hợp lệ login lại được sau cửa sổ; X-Forwarded-For giả từ client không đổi IP key |
| `POST /auth/refresh` | rotation strict: R1→R2; reuse R1 → 401 + revoke family + sid + audit; refresh song song cùng token → đúng 1 thành công (concurrency test 10 request); family >30 ngày / idle >7 ngày → 401; DB chỉ lưu SHA-256 |
| `POST /auth/logout`, `/auth/reauth` | logout revoke sid hiện tại, sid khác vẫn sống; reauth không tạo sid mới; route nhạy cảm sau >5 phút cần reauth |
| JWT | sai `alg` (HS256/none), `kid` ngoài allowlist, `aud`/`iss` sai, hết hạn → 401; JWT hợp lệ nhưng sid revoked/device revoked/user disabled → 401 (stale JWT); role trong JWT là `admin` nhưng DB là `user` → 403 trên `/admin/*` (role downgrade) |
| `GET/PATCH /me`, `/me/password`, `/me/delete` | PATCH chỉ name/about (role/email → 400); password/delete cần recent reauth; delete revoke mọi session/device trong transaction; owner group phải transfer trước |
| `/sessions`, `/devices` | chỉ thấy của mình; `DELETE /sessions/{sid}` của user khác → 404; revoke → socket disconnect ≤1s (đo); 4th device approve → 409; enroll pending không gọi được chat API |
| Socket | handshake token trong `auth` (token qua query → reject); JWT hết hạn → server disconnect theo timer không đợi packet; >2 connection/sid → reject; event lạ/packet >8 KiB → reject |
| Audit/log | log và audit không chứa password/token/refresh/plaintext (grep output test) |

## 7. Test plan T-15 (group/message/vectors adversarial, 22–24/11)

| Nhóm | Test case |
|---|---|
| Vectors | `vectors.test.js` provider `product` (src/security của C) chạy toàn bộ positive + negative; golden envelope `wc-e2ee-v1` (AAD JCS, info có NUL byte, wrapAAD) giống nhau Node vs Hermes |
| Envelope reject | lật bit nonce/tag/ciphertext/header/wrap/signature → generic verification error; version/suite lạ, unknown field, duplicate JSON key, base64url sai/độ dài sai, counter không canonical → reject trước crypto; all-zero X25519 → reject |
| Ma trận quyền nhóm (plan §3) | owner: rename/add/remove/promote/demote/transfer/dissolve OK; admin: rename, invite friend accepted, kick member OK; admin kick owner/admin, đổi role, tự promote, dissolve → 403; member add/kick/rename/role → 403; non-member mọi thao tác → 404; owner leave khi chưa transfer → 409; transfer owner nguyên tử (concurrent 2 transfer → 1 thành công, vẫn đúng 1 owner) |
| Membership | group 11 người → 409 (concurrent accept 2 invite khi đang 9 người → đúng 1 thành công); add cần target accept; direct chat cần friendship accepted; direct pair unique khi tạo đồng thời |
| Message | sender binding JWT (senderUserId/DeviceId khác token → 403); recipient set khác roster hiện tại → 409 `ROSTER_CHANGED`; 30-device fixture (≤30 wraps) pass, 31 → 400; counter replay → 409; exact retry 200 idempotent (1 row/event/unread); cùng ID khác hash → 409; kick vs send race linearized |
| History/IDOR | outsider/kicked/new device GET message/history → 404/không ciphertext; cursor limit ≤50; admin platform không bypass audience |
| Recall/expiry | recall chỉ original sender ≤10 phút, controlId idempotent; expiresAt <60s hoặc >24h → 400 (fixture `message-expiry.invalid-too-soon`); GET sau expiry deny kể cả cron tắt |

## 8. Test plan T-21 (attack kit + files/lifecycle/socket, 25–27/11)

- Hiện thực `security-demo/a…g/run.js` theo README từng kịch bản, output JSON redacted vào `docs/security/evidence/`, mapping MASVS.
- `tests/server/files*`: upload init chỉ member, PUT one-use bound session, magic `WCFILE1` + độ dài + hash sai → reject, vượt cap (10/5 MiB + overhead) → 413, 2 upload đồng thời/device, quota 100 MiB/ngày, GET outsider/new device/kicked/expired → 404, không static route, orphan cleanup >1h.
- Lifecycle/socket: reconnect kéo `/sync` không mất/trùng tin (dedup eventId), cursor quá 7 ngày → `RESYNC_REQUIRED`, presence chỉ friend/shared member, offline ≤30s khi mất mạng, revoked sid không online.
- f (pinning) và g (at-rest) cần thiết bị/emulator rooted: phối hợp A.

## 9. Cần từ Codex (C) / Helper A (A) / lead

| Ai | Cần gì | Khi nào |
|---|---|---|
| Lead → Helper A (owner root package) | **dependencies** (runtime cho `src/security`): `@noble/curves`, `@noble/hashes`, `@noble/ciphers`; nếu v2 ESM-only thì A thêm vào `transformIgnorePatterns`. **devDependencies**: `ajv@^8` + `ajv-formats@^3` (thay bản transitive). **ĐÃ XONG 16/11** (noble 2.4.0, ajv 8.20.0), B đã verify | — |
| C | Seed CLI demo (users alice/bob/carol/mallory/admin, devices, group 3 người) + lệnh reset chỉ trên DB demo; test DB container + helper Fastify `inject` cho `tests/server/*`; cách chạy migration test | 19/11 |
| C | API `src/security/*` (tên hàm X25519/Ed25519/HKDF/GCM/JCS/envelope) để viết provider `product`; golden envelope fixture | 22/11 |
| C | Adapter outbox/API mới (T-08) để viết lại regression #3/#4 | 21/11 |
| C | Xác nhận `jest.config.js` / root test script có nên include `tests/server/**` (node env) hay chạy riêng trong `server/` | 19/11 |
| A | Build control (package ID khác) và pinned lab build cho kịch bản f; emulator rooted cho g; xác nhận cách logout xóa outbox (T-07) | 24–25/11 |
| A | Kiểm TDZ runtime trên Hermes nếu muốn bằng chứng ngoài kiểm tĩnh | tùy chọn |

## 10. File đã tạo

```
tests/regression/helpers/memoryFirestore.js
tests/regression/helpers/tdzCheck.js
tests/regression/tools/make-head-baseline.js
tests/regression/users-screen.test.js
tests/regression/outbox-account-switch.test.js
tests/regression/retry-lost-ack.test.js
tests/security/vectors.test.js
tests/security/vectors/{x25519.rfc7748,ed25519.rfc8032,hkdf-sha256.rfc5869,aes-256-gcm.mcgrew-viega,sha256.fips180,jcs.rfc8785,negative-cases}.json
tests/security/vectors/jcs-reference.js
tests/contracts/contracts.test.js
tests/contracts/fixture-map.json
tests/contracts/expected-endpoints.json
security-demo/README.md
security-demo/lib/guard.js
security-demo/__tests__/guard.test.js
security-demo/{a-bruteforce,b-idor,c-tamper,d-replay,e-refresh-reuse,f-mitm-pinning,g-at-rest}/{README.md,run.js}
docs/plan/03-p0-helperB-notes.md
```
