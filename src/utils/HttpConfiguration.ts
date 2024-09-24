class PrefixEntry {
    urlPrefix: string;
    headers: Map<string, string>;

    /**
     * @param urlPrefix - The URL prefix for this host entry.
     */
    constructor(urlPrefix: string) {
        this.urlPrefix = urlPrefix;

        this.headers = new Map();
    }

    /**
     * Sets a custom header applicable for URLs that match the prefix.
     *
     * @param name - The header name.
     * @param value - The header value.
     */
    setHeader(name: string, value: string) {
        this.headers.set(name, value);
    }
}

const perHostProperties: Map<string, Array<PrefixEntry>> = new Map();

/**
 * Update the request options with stored configuration applicable to this URL.
 *
 * @param input - The URL.
 * @param options - The request options.
 * @returns The updated options, if any. If no options object is passed, and no
 * configuration applies to this URL, then returns `undefined`.
 * @example
 * HttpConfiguration.setHeader('http://example.com', 'Foo', 'bar');
 *
 * const fetchOptions = \{
 *  method: 'POST',
 *  body: 'whatever',
 *  headers: \{
 *      Width: 200,
 *  \}
 * \};
 *
 * // Let's update the options with headers applicable to 'http://example.com'
 * HttpConfiguration.applyConfiguration('http://example.com', fetchOptions);
 *
 * // now fetchOptions should be
 * // \{
 * //     method: 'POST',
 * //     body: 'whatever',
 * //     headers: \{
 * //         Width: 200,
 * //         Foo: 'bar',
 * //     \}
 * // \}
 *
 * // We can now send our HTTP request with correct headers
 * fetch('http://example.com/index.html', fetchOptions);
 */
function applyConfiguration(
    input: RequestInfo | URL,
    options?: RequestInit,
): RequestInit | undefined {
    if (perHostProperties.size === 0) {
        return options;
    }

    let urlObj: URL;

    if (typeof input === 'string') {
        urlObj = new URL(input);
    } else if (input instanceof URL) {
        urlObj = input;
    } else {
        urlObj = new URL(input.url);
    }

    const properties = perHostProperties.get(urlObj.hostname);
    if (!properties) {
        // Nothing to do
        return options;
    }

    if (!options) {
        options = {};
    }
    const headers = (options.headers ?? {}) as Record<string, string>;

    const urlString = urlObj.toString();

    for (const entry of properties) {
        if (urlString.startsWith(entry.urlPrefix)) {
            for (const [k, v] of entry.headers.entries()) {
                if (headers[k]) {
                    // The request already has a header with the same name.
                    // We may not override it as it was already set either by the user manually,
                    // or by a previous entry with higher precedence.
                    continue;
                }

                headers[k] = v;
            }
        }
    }

    options.headers = headers;

    return options;
}

/**
 * Sets the header for all HTTP requests that match the provided URL prefix.
 *
 * Note: The URL prefix must be a valid URL (e.g must contain a scheme and and host).
 *
 * @param urlPrefix - The URL prefix.
 * @param name - The header name.
 * @param value - The header value.
 */
function setHeader(urlPrefix: string, name: string, value: string) {
    const url = new URL(urlPrefix);
    const hostname = url.hostname;

    let hostEntry = perHostProperties.get(hostname);

    if (!hostEntry) {
        hostEntry = [];
        perHostProperties.set(hostname, hostEntry);
    }

    let prefixEntry = hostEntry.find(entry => entry.urlPrefix === urlPrefix);

    if (!prefixEntry) {
        prefixEntry = new PrefixEntry(urlPrefix);
        hostEntry.push(prefixEntry);
        // We want prefixes to be ordered from longer (more specific) to shorter (more global)
        hostEntry.sort((a, b) => b.urlPrefix.length - a.urlPrefix.length);
    }

    prefixEntry.setHeader(name, value);
}

/**
 * Sets the 'Authorization' header for the specified URL prefix.
 *
 * Note: this is a convenience function that calls {@link setHeader} internally:
 *
 * ```js
 * setHeader(urlPrefix, 'Authorization', value)
 * ```
 *
 * @param urlPrefix - The URL prefix.
 * @param value - The header value
 * @example
 * // We wish to set the Authorization header for the 'example.com'
 * // domain to 'Bearer TOPLEVEL', except for the resources under
 * // 'example.com/sub/resource', where we use 'Bearer SUBRESOURCE'.
 * //
 * // Since 'example.com/sub/resource' is a longer prefix than 'example.com',
 * // its headers will have precedence and will be applied to HTTP requests
 * // that match this URL prefix.
 * HttpConfiguration.setAuth('https://example.com', 'Bearer TOPLEVEL');
 * HttpConfiguration.setAuth('https://example.com/sub/resource', 'Bearer SUBRESOURCE');
 *
 * HttpConfiguration.applyConfiguration('https://example.com/index.html')
 * // \{ 'Authorization', 'Bearer TOPLEVEL' \}
 * HttpConfiguration.applyConfiguration('https://example.com/sub/resource/index.html')
 * // \{ 'Authorization', 'Bearer SUBRESOURCE' \}
 */
function setAuth(urlPrefix: string, value: string) {
    setHeader(urlPrefix, 'Authorization', value);
}

/**
 * Removes all configurations.
 */
function clear() {
    perHostProperties.clear();
}

/**
 * Contains configuration for HTTP requests.
 *
 * Configuration is based on _URL prefixes_: each configuration entry applies to an URL prefix and
 * will apply to any URL that matches this prefix. Longer prefixes have more precedence over shorter
 * ones, so that you can cascade configurations. For example, you can have a general configuration
 * for the `example.com` domain, then more specific configuration entries for sub-paths in the same
 * domain.
 *
 * Note: URL prefixes must be valid absolute URLs (including scheme): `http://example.com/foo` is a
 * valid prefix, but `example.com/foo` is not.
 *
 * Note: If you plan to use the same configuration for different schemes (e.g `http` and `https`,
 * you must register the configuration twice, one for each scheme).
 *
 * Important: this module do _not_ automatically process outgoing HTTP requests. It is not a service
 * worker or a middleware. The `Fetcher` module automatically processes the requests by querying
 * configuration from this module, but if you can't or don't want to use `Fetcher`, then you have to
 * patch the request yourself (see the example below).
 *
 * @example
 * // Set the `Accept-Language` header to `fr-CH` for all requests under `http://example.com`.
 * HttpConfiguration.setHeader('http://example.com', 'Accept-Language', 'fr-CH');
 *
 * // Later, query the configuration for a resource under `http://example.com`
 * const fetchOptions = HttpConfiguration.applyConfiguration('http://example.com/myPage.html');
 *
 * // And put the options in the fetch request.
 * fetch('http://example.com/myPage.html', fetchOptions);
 */
export default {
    setAuth,
    setHeader,
    applyConfiguration,
    clear,
};
