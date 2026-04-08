/**
 * Converts a project name into a URL-safe slug.
 * Lowercases, trims, and replaces spaces/special chars with hyphens.
 * @param {string} name - Raw project name
 * @returns {string} URL-safe slug (e.g. "My API v2" → "my-api-v2")
 */
export function slugify(name = "") {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric runs → hyphen
        .replace(/^-+|-+$/g, "");    // strip leading/trailing hyphens
}

/**
 * Reverses a slug back to a display-friendly string for lookup (best-effort).
 * Real lookup should always be done against the `name` field in the projects array.
 * @param {string} slug
 * @returns {string}
 */
export function unslugify(slug = "") {
    return slug.replace(/-/g, " ");
}
