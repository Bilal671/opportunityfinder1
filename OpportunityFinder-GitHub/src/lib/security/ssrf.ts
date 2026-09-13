import dns from 'node:dns';
import net from 'node:net';

export interface SSRFValidationResult {
  safe: boolean;
  reason?: string;
  normalizedUrl?: string;
  ip?: string;
}

/**
 * Checks if an IPv4 address is in a private, reserved, loopback, or link-local range.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 is treated as unsafe
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (Private)
  if (b0 === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (Private)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;

  // 192.168.0.0/16 (Private)
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (b0 >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (b0 === 255 && b1 === 255 && parts[2] === 255 && parts[3] === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, or link-local range.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback (::1)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified (::)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // IPv4 mapped IPv6 (::ffff:192.0.2.128)
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.replace('::ffff:', '');
    if (net.isIPv4(v4)) {
      return isPrivateOrReservedIPv4(v4);
    }
  }

  // Unique Local Addresses (fc00::/7 - fc00:: through fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-Local Addresses (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) return true;

  return false;
}

/**
 * Validates a target URL against SSRF attacks:
 * 1. Protocol must be http or https
 * 2. Hostname must be present and not blocked (e.g. metadata, localhost)
 * 3. DNS resolution to check actual target IP address against blocked CIDR blocks
 */
export async function validateUrlSafety(inputUrl: string): Promise<SSRFValidationResult> {
  try {
    let parsed: URL;
    try {
      parsed = new URL(inputUrl);
    } catch {
      return { safe: false, reason: 'Invalid URL structure' };
    }

    // Protocol check: only http: and https:
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata' ||
      hostname.includes('169.254.169.254')
    ) {
      return { safe: false, reason: `Blocked hostname: ${hostname}` };
    }

    // Port check: allow standard web ports 80, 443 (or standard web ports)
    const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
    if (port !== 80 && port !== 443 && port !== 8080 && port !== 8443) {
      return { safe: false, reason: `Disallowed port: ${port}. Only standard web ports (80, 443, 8080, 8443) are allowed.` };
    }

    // Check if hostname is already an IP literal
    if (net.isIP(hostname)) {
      if (net.isIPv4(hostname) && isPrivateOrReservedIPv4(hostname)) {
        return { safe: false, reason: `Direct IP ${hostname} is within a reserved or private range.`, ip: hostname };
      }
      if (net.isIPv6(hostname) && isPrivateOrReservedIPv6(hostname)) {
        return { safe: false, reason: `Direct IPv6 ${hostname} is within a reserved or private range.`, ip: hostname };
      }
      return { safe: true, normalizedUrl: parsed.toString(), ip: hostname };
    }

    // Resolve DNS
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, reason: `Unable to resolve host ${hostname}` };
    }

    for (const record of addresses) {
      if (record.family === 4 && isPrivateOrReservedIPv4(record.address)) {
        return { safe: false, reason: `Resolved IP ${record.address} for host ${hostname} is private or reserved.`, ip: record.address };
      }
      if (record.family === 6 && isPrivateOrReservedIPv6(record.address)) {
        return { safe: false, reason: `Resolved IPv6 ${record.address} for host ${hostname} is private or reserved.`, ip: record.address };
      }
    }

    return { safe: true, normalizedUrl: parsed.toString(), ip: addresses[0].address };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown DNS error';
    return { safe: false, reason: `DNS lookup failed: ${msg}` };
  }
}
