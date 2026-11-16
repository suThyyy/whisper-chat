# g) Dump AsyncStorage/cache trên rooted emulator

| | |
|---|---|
| Task | T-07, T-12, T-17, T-21 |
| MASVS group | MASVS-STORAGE, MASVS-CRYPTO |
| Destructive | Không — cần `--demo-only` |
| Endpoint (contract v1.0.0) | `(không gọi API) adb shell / run-as trên emulator rooted` |
| Trạng thái | Skeleton (P0). Chưa gọi API thật; hiện thực ở T-21 khi T-07 xong. |

## Prerequisites
- Emulator rooted cài release-demo build.
- Alice có message pending trong outbox + history; app đã lock rồi kill.
- Marker text duy nhất (ví dụ WC-MARKER-<random>) đã gửi trước đó.

## Các bước
1. adb pull thư mục data của app (AsyncStorage, cache, files).
2. grep marker text, email, password demo, refresh token pattern, private key bytes.
3. Thử decrypt outbox record bằng key sai → fail (GCM tag).
4. Xác nhận chỉ SecureStore/Keystore giữ key (không có trong dump).

## Expected result
Không plaintext/password/refresh/private key; chỉ ciphertext ngoài SecureStore.

## Machine assertions
- [ ] 0 match marker/password/refresh/private key trong dump
- [ ] decrypt key sai = fail
- [ ] outbox record là ciphertext có AAD bind uid/device

## Chạy
```sh
node security-demo/g-at-rest/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run   # in kế hoạch
node security-demo/g-at-rest/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1
```
Exit code: 0 pass, 1 assertion fail, 2 guard/setup, 3 chưa hiện thực.

Kịch bản có phần thao tác thiết bị/proxy thủ công; script chỉ kiểm tra điều kiện và thu evidence.

## Reset / cleanup
Xem `security-demo/README.md` mục Reset. Report chỉ ghi requestId và kết quả đã redact; không ghi password/token/key.
