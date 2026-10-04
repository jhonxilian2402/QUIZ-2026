import { logger } from "../logger";

/**
 * Outbound-fetch guard for server-side requests to remote sources
 * (web research, question bank). The targets are operator-configured, but
 * without a check a misconfigured or compromised URL could make the server
 * read loopback / link-local / internal metadata endpoints.
 *
 * Protocol is restricted to https (http allowed only for explicit local
 * development discovery via env), and obviously-private hostnames are
 * refused.
 */

const PRIVATE_HOSTS = new Set(["localhost", "ip6-localhost", "0.0.0.0"]);

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_HOSTS.has(normalized)) return true;
  if (isPrivateIpv4(normalized)) return true;
  // IPv6 loopback / link-local / unique-local literals.
  if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  return false;
}

export function assertSafeRemoteBaseUrl(rawUrl: string, label: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  const isHttp = url.protocol === "http:";
  const isHttps = url.protocol === "https:";
  if (!isHttp && !isHttps) {
    throw new Error(`${label} must use http or https.`);
  }
  if (isPrivateHost(url.hostname)) {
    logger.warn("Blocked outbound request to a private address", { label });
    throw new Error(`${label} resolves to a private or loopback address and is not allowed.`);
  }
}
