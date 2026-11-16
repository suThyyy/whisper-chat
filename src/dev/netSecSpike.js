/**
 * Network Security & SSL Pinning Spike Test Harness.
 * Verified on Android Emulator Pixel_8_Pro (API 34).
 * Used only when EXPO_PUBLIC_RUN_PIN_TEST is enabled or during local security testing.
 *
 * Chỉ test REST GET /v1/health trên gateway thật (CA + pin từ infra/public).
 * WSS chưa test ở đây: socket gateway yêu cầu auth (token) nên không gọi ẩn danh được;
 * WSS dùng chung network_security_config (cùng domain/pin-set) nên sẽ kiểm ở bước tích hợp auth.
 */
export const runNetworkSecurityTest = async () => {
  console.log('=== [NET_SEC_TEST_START] ===');
  const gatewayHost = process.env.EXPO_PUBLIC_GATEWAY_HOST || '10.0.2.2';
  const healthUrl = `https://${gatewayHost}:8443/v1/health`;

  try {
    console.log(`[NET_SEC_REST] Requesting GET ${healthUrl} ...`);
    const res = await fetch(healthUrl);
    const data = await res.json();
    if (!res.ok || data.status !== 'ready') {
      throw new Error(`Unexpected health response: HTTP ${res.status}`);
    }
    console.log(`[NET_SEC_REST_SUCCESS] Status: ${res.status}, body: ${JSON.stringify(data)}`);
  } catch (err) {
    console.log(`[NET_SEC_REST_FAILURE] ${err.name}: ${err.message}`);
  }
};

export default runNetworkSecurityTest;
