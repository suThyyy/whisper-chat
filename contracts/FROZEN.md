# Contract freeze v1.0.0 — frozen-approved

Trạng thái: **frozen-approved**. Lead phê duyệt có điều kiện ngày 16/11/2026; bốn điều kiện đã áp dụng trước khi đổi trạng thái.

## Inventory

- OpenAPI 3.1: 48 paths, 53 operations; mỗi operation có request/response hoặc mô tả body, auth policy và `x-rate-limit` tương ứng.
- Socket contract: websocket-only handshake và 6 event types (`sync.request`, `event.ack`, `inbox.changed`, `presence.changed`, `session.revoked`, `session.expiring`).
- E2EE schema: envelope v1, recall control, canonical encoding notes và `WCFILE1` binary layout.
- Fixtures: 10 JSON files cho auth/direct/group/message expiry/recall, gồm valid và invalid examples; tất cả là dữ liệu giả `.invalid`.
- Database: 22 Prisma models, 9 enums; PostgreSQL là nguồn transaction duy nhất.

## Contract rules not expressible completely in JSON Schema

Server MUST reject an HTTP envelope larger than 256 KiB **before** JSON parsing or signature verification. It MUST additionally enforce canonical JCS order, recipient/wrap one-to-one equality and sorting, exact decoded byte lengths, cryptographic signatures/tags, exact current roster, expiry range 60 seconds–24 hours, membership/RBAC, monotonic counters, idempotency, upload binary magic/length/hash, and account/device/session state. A schema-valid payload is not necessarily authorized or cryptographically valid.

## Deliberate clarifications/deviations from plan prose

1. Account deletion is `POST /v1/me/delete` instead of `DELETE /v1/me` so the mandatory confirmation and recent-auth proof have an unambiguous request schema across clients/proxies.
2. Device enrollment is unauthenticated only in HTTP terms; it requires a short-lived restricted enrollment token plus a one-use challenge proof. It never returns chat access before approval.
3. Socket payloads remain ID-only. Message/file ciphertext is hydrated through authorized REST after a durable inbox event.
4. The OpenAPI file references the E2EE JSON Schema as an external local contract. CI must resolve multi-file refs from `contracts/`, not validate the YAML as an isolated document.
5. Prisma expresses portable relations and indexes; transaction-only constraints (one active group owner, maximum 10 active members, maximum 3 approved devices, canonical pair ordering, exact roster locking) require SQL migration checks/triggers where suitable plus service transaction tests.

## Freeze procedure

Lead đã phê duyệt v1.0.0. Mọi breaking change sau mốc này phải cập nhật `CHANGELOG.md`, contract version và mọi fixture/test bị ảnh hưởng, rồi được lead + owner client/server duyệt.
