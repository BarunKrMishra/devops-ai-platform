import net from 'net';

// Cloud instance-metadata endpoints — the classic SSRF target. We block these
// on every outbound request. We intentionally do NOT block private/LAN ranges,
// because connecting to on-prem monitoring (Prometheus/Grafana on 10.x/192.168.x)
// is a legitimate, supported feature.
const BLOCKED_HOSTS = new Set([
  '169.254.169.254',        // AWS / Azure / GCP IMDS
  'metadata.google.internal',
  'metadata',
  '100.100.100.200'         // Alibaba Cloud metadata
]);

export const isBlockedRequestUrl = (rawUrl) => {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (BLOCKED_HOSTS.has(host)) {
      return true;
    }
    // Entire IMDS link-local range 169.254.0.0/16.
    if (net.isIP(host) === 4 && host.startsWith('169.254.')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
