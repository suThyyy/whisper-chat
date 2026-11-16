# a) Brute-force login → 429/Retry-After/backoff

| | |
|---|---|
| Task | T-06, T-09, T-21 |
| MASVS group | MASVS-AUTH, MASVS-NETWORK; backend ASVS V2/V11 (rate limiting) |
| Destructive | Không — cần `--demo-only` |
| Endpoint (contract v1.0.0) | `POST /auth/challenge`, `POST /auth/login` |
| Trạng thái | Skeleton (P0). Chưa gọi API thật; hiện thực ở T-21 khi T-06 xong. |

## Prerequisites
- Seed user `victim@example.invalid` với password demo biết trước (seed CLI của C).
- Attacker không có device proof hợp lệ; dùng email victim + password sai.
- Gateway có limiter PostgreSQL (T-06) bật.

## Các bước
1. Gửi 11 login sai từ cùng IP trong 10 phút → kỳ vọng request thứ 11 bị 429 + header Retry-After (10/10phút/IP).
2. Từ IP thứ hai (hoặc sau khi bucket IP hết hạn) thử 6 login sai cho cùng email → kỳ vọng 429 theo HMAC(email) (5/15phút).
3. Đo độ trễ phản hồi tăng dần 1/2/4/8/16/30s (cap 30s).
4. Restart container gateway → gửi thêm 1 login sai → vẫn 429 (bucket persistent).
5. Sau khi hết cửa sổ, victim login đúng → 200 (không khóa vĩnh viễn).

## Expected result
429 + Retry-After, backoff tăng, không lockout vĩnh viễn, restart không reset limiter.

## Machine assertions
- [ ] status 429 xuất hiện đúng ngưỡng
- [ ] Retry-After là số nguyên dương
- [ ] error body {code,message,requestId} không tiết lộ email tồn tại hay không
- [ ] restart không reset bucket
- [ ] login hợp lệ sau cửa sổ = 200

## Chạy
```sh
node security-demo/a-bruteforce/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1 --dry-run   # in kế hoạch
node security-demo/a-bruteforce/run.js --demo-only --base-url=https://whisperchat.lan:8443/v1
```
Exit code: 0 pass, 1 assertion fail, 2 guard/setup, 3 chưa hiện thực.

## Reset / cleanup
Xem `security-demo/README.md` mục Reset. Report chỉ ghi requestId và kết quả đã redact; không ghi password/token/key.
