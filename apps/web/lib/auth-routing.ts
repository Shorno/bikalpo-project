const PORTAL_SUBDOMAIN_PREFIXES = new Set([
  "shop",
  "b2b",
  "warehouse",
  "delivery",
  "sales",
]);

function stripKnownPortalSubdomain(host: string) {
  const [prefix, ...rest] = host.split(".");

  if (prefix && rest.length > 0 && PORTAL_SUBDOMAIN_PREFIXES.has(prefix)) {
    return rest.join(".");
  }

  return host;
}

export function getRootLoginUrl() {
  if (typeof window === "undefined") {
    return "/login";
  }

  const rootHost = stripKnownPortalSubdomain(window.location.host);
  return `${window.location.protocol}//${rootHost}/login`;
}

export function redirectToRootLogin() {
  window.location.href = getRootLoginUrl();
}
