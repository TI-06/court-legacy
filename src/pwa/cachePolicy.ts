export type PwaCacheMode = "network-only" | "static-cache";

export function classifyRequestForCache(
  request: Pick<Request, "method" | "url">,
  applicationOrigin = globalThis.location?.origin,
): PwaCacheMode {
  if (request.method.toUpperCase() !== "GET") return "network-only";

  const baseOrigin = applicationOrigin ?? "https://local.invalid";
  const url = new URL(request.url, baseOrigin);

  if (applicationOrigin && url.origin !== applicationOrigin) {
    return "network-only";
  }
  if (url.pathname.startsWith("/api/")) return "network-only";

  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/")
  ) {
    return "static-cache";
  }

  return "network-only";
}
