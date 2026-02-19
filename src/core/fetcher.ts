// ─── GitHub Raw Content Fetcher ──────────────────────────────────────────────
// Fetches raw file content from public GitHub repositories with session caching.

/** In-memory session cache to avoid redundant network requests. */
const cache = new Map<string, string>();

/**
 * Build a raw.githubusercontent.com URL.
 */
function buildRawUrl(owner: string, repo: string, path: string, branch = 'main'): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

/**
 * Fetch raw text content from a GitHub repository file.
 * Results are cached for the duration of the plugin session.
 *
 * @throws Error if the fetch fails or returns a non-OK status.
 */
export async function fetchRawFromGitHub(
    owner: string,
    repo: string,
    path: string,
    branch = 'main'
): Promise<string> {
    const url = buildRawUrl(owner, repo, path, branch);

    if (cache.has(url)) {
        return cache.get(url)!;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${path} from ${owner}/${repo} (${response.status}: ${response.statusText})`
        );
    }

    const text = await response.text();
    cache.set(url, text);
    return text;
}

/**
 * Fetch raw text content from an arbitrary URL.
 * Results are cached for the duration of the plugin session.
 */
export async function fetchRawUrl(url: string): Promise<string> {
    if (cache.has(url)) {
        return cache.get(url)!;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url} (${response.status}: ${response.statusText})`);
    }

    const text = await response.text();
    cache.set(url, text);
    return text;
}

/** Clear the session cache. Useful for manual refresh. */
export function clearCache(): void {
    cache.clear();
}
