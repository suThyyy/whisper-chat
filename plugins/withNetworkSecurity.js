const {
  withAndroidManifest,
  withDangerousMod,
  createRunOncePlugin,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'withNetworkSecurity';

/**
 * Check if a host is an IPv4 or IPv6 address.
 * Android Network Security Config specifies that includeSubdomains attribute
 * is only supported for domain names, not IP addresses.
 */
function isIpAddress(host) {
  if (!host) return false;
  // IPv4 or IPv6
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host.includes(':');
}

/**
 * Strip optional leading sha256/ or SHA-256/ prefix so the pin is purely base64.
 */
function normalizePin(pin) {
  if (!pin) return '';
  const raw = typeof pin === 'object' && pin.value ? pin.value : String(pin);
  return raw.replace(/^sha256\//i, '').trim();
}

/**
 * Generate network_security_config.xml content.
 * Prohibits cleartext traffic, does NOT trust user CAs in release/base config,
 * restricts custom CA trust to gateway domains, and enforces SPKI pinning via <pin-set>.
 */
function generateNetworkSecurityConfig({ domains, pins, pinExpiration }) {
  const uniqueDomains = [...new Set(domains.filter(Boolean))];

  const domainElements = uniqueDomains
    .map((d) => {
      const includeSubdomains = isIpAddress(d) ? 'false' : 'true';
      return `        <domain includeSubdomains="${includeSubdomains}">${d}</domain>`;
    })
    .join('\n');

  const normalizedPins = pins.map(normalizePin).filter(Boolean);
  if (normalizedPins.length === 0) {
    throw new Error(
      `[withNetworkSecurity] Prebuild failed: No SPKI pins provided for <pin-set>. ` +
        `Ensure infra/public/pins.json contains at least one valid pin.`
    );
  }

  const pinElements = normalizedPins
    .map((p) => `            <pin digest="SHA-256">${p}</pin>`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Base config: cấm toàn bộ cleartext HTTP, chỉ tin cậy system CAs, KHÔNG trust user CAs trong release -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- Domain config: Chỉ tin cậy CA riêng của nhóm và ghim SPKI qua <pin-set> cho các domain gateway -->
    <domain-config cleartextTrafficPermitted="false">
${domainElements}
        <pin-set expiration="${pinExpiration}">
${pinElements}
        </pin-set>
        <trust-anchors>
            <certificates src="@raw/custom_ca" />
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
</network-security-config>
`;
}

const withNetworkSecurityXml = (config, options = {}) => {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const resDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );
      const xmlDir = path.join(resDir, 'xml');
      const rawDir = path.join(resDir, 'raw');

      // Ensure target resource directories exist
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(rawDir, { recursive: true });

      const caPath = path.join(projectRoot, 'infra', 'public', 'ca.crt');
      if (!fs.existsSync(caPath)) {
        throw new Error(
          `[withNetworkSecurity] Prebuild failed: required CA is missing: ${caPath}`
        );
      }
      const caContent = fs.readFileSync(caPath, 'utf8').trim();
      if (!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(caContent)) {
        throw new Error(
          `[withNetworkSecurity] Prebuild failed: invalid PEM certificate: ${caPath}`
        );
      }

      // Write verified CA certificate into res/raw/custom_ca.crt
      const rawCaPath = path.join(rawDir, 'custom_ca.crt');
      fs.writeFileSync(rawCaPath, caContent.trim() + '\n', 'utf8');

      const pinsPath = path.join(projectRoot, 'infra', 'public', 'pins.json');
      if (!fs.existsSync(pinsPath)) {
        throw new Error(
          `[withNetworkSecurity] Prebuild failed: required pin manifest is missing: ${pinsPath}`
        );
      }
      let pinManifest;
      try {
        pinManifest = JSON.parse(fs.readFileSync(pinsPath, 'utf8'));
      } catch (error) {
        throw new Error(
          `[withNetworkSecurity] Prebuild failed: invalid JSON in ${pinsPath}: ${error.message}`
        );
      }
      const host = typeof pinManifest.host === 'string' ? pinManifest.host.trim() : '';
      let pins = Array.isArray(pinManifest.pins)
        ? pinManifest.pins.map(normalizePin).filter(Boolean)
        : [];

      // CHỈ dùng cho kiểm thử negative (pin sai → SSLHandshakeException).
      // Biến build-time, KHÔNG có tiền tố EXPO_PUBLIC_ nên không lọt vào JS bundle.
      // Không bao giờ đặt biến này khi build bản phát hành.
      const pinTestOverride = process.env.WHISPERCHAT_PIN_TEST_OVERRIDE?.trim();
      if (pinTestOverride) {
        pins = pinTestOverride.split(',').map(normalizePin).filter(Boolean);
        console.warn(
          `[withNetworkSecurity] WARNING: WHISPERCHAT_PIN_TEST_OVERRIDE is set; ` +
            `ignoring pins from ${pinsPath}. Test builds only.`
        );
      }
      const pinExpiration = pinManifest.expiration;
      if (!host || pins.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(pinExpiration || '')) {
        throw new Error(
          `[withNetworkSecurity] Prebuild failed: ${pinsPath} must contain host, non-empty pins, and expiration (YYYY-MM-DD).`
        );
      }
      for (const pin of pins) {
        if (!/^[A-Za-z0-9+/]{43}=$/.test(pin) || Buffer.from(pin, 'base64').length !== 32) {
          throw new Error(
            `[withNetworkSecurity] Prebuild failed: invalid SHA-256 SPKI pin "${pin}" ` +
              `(from ${pinTestOverride ? 'WHISPERCHAT_PIN_TEST_OVERRIDE' : pinsPath}).`
          );
        }
      }

      const gatewayOverride = process.env.EXPO_PUBLIC_GATEWAY_HOST?.trim();
      const domains = [host, '10.0.2.2', '192.168.52.74', gatewayOverride];

      // 3. Write network_security_config.xml
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');
      const xmlContent = generateNetworkSecurityConfig({
        domains,
        pins,
        pinExpiration,
      });
      fs.writeFileSync(xmlPath, xmlContent, 'utf8');

      return modConfig;
    },
  ]);
};

const withNetworkSecurityManifest = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults
    );
    mainApp.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return modConfig;
  });
};

const withNetworkSecurity = (config, options = {}) => {
  config = withNetworkSecurityManifest(config);
  config = withNetworkSecurityXml(config, options);
  return config;
};

module.exports = createRunOncePlugin(
  withNetworkSecurity,
  PLUGIN_NAME,
  '1.0.0'
);
