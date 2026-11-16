#!/usr/bin/env node
/*
 * Attack kit g) Dump AsyncStorage/cache trên rooted emulator
 * Skeleton P0 (T-04): guard + kế hoạch; logic gọi API thật làm ở T-21 theo contracts/openapi.yaml v1.0.0.
 */
const { runScenario, notImplemented } = require('../lib/guard');

const meta = {
  id: 'g',
  title: "Dump AsyncStorage/cache trên rooted emulator",
  masvs: "MASVS-STORAGE, MASVS-CRYPTO",
  endpoints: ["(không gọi API) adb shell / run-as trên emulator rooted"],
  steps: [
    "adb pull thư mục data của app (AsyncStorage, cache, files).",
    "grep marker text, email, password demo, refresh token pattern, private key bytes.",
    "Thử decrypt outbox record bằng key sai → fail (GCM tag).",
    "Xác nhận chỉ SecureStore/Keystore giữ key (không có trong dump)."
  ],
};

// eslint-disable-next-line no-unused-vars
const main = async (ctx) => {
  // TODO(T-21): hiện thực các bước trong meta.steps, trả về { pass, checks: [{name, ok, requestId}] }.
  throw notImplemented('scenario g pending T-21');
};

if (require.main === module) {
  runScenario(meta, main, { destructive: false });
}

module.exports = { meta, main };
