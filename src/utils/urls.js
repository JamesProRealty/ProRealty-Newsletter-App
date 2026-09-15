/**
 * Rex sometimes returns "protocol-relative" URLs like "//au-crm.cdns.rexsoftware.com/...",
 * missing the "https:" at the front. Browsers handle these fine on a live webpage (they
 * just reuse whatever protocol the page itself loaded with), but that trick doesn't apply
 * in an email — there's no "current page" for the client to infer a protocol from, so the
 * image would silently fail to load. This fixes that by adding "https:" wherever it's missing.
 */
function normalizeUrl(url) {
  if (typeof url !== "string") return url;
  const trimmed = url.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
}

/**
 * Applies normalizeUrl() to every photo URL in a listing payload — the top-level
 * `photos` array and each agent's `photoSrc` — without touching anything else.
 */
function normalizeListingPayload(payload) {
  const out = { ...payload };
  if (Array.isArray(out.photos)) {
    out.photos = out.photos.map(normalizeUrl);
  }
  if (Array.isArray(out.agents)) {
    out.agents = out.agents.map((agent) => (
      agent && typeof agent === "object"
        ? { ...agent, photoSrc: normalizeUrl(agent.photoSrc) }
        : agent
    ));
  }
  return out;
}

module.exports = { normalizeUrl, normalizeListingPayload };
