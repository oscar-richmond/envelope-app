
// import { parseStringPromise } from 'xml2js'; // removed to avoid missing dependency

export async function detectSitemap(domain: string, isHttps: boolean): Promise<{ exists: boolean; lastModified?: Date }> {
    const protocol = isHttps ? 'https' : 'http';
    const commonPaths = [
        '/sitemap.xml',
        '/sitemap_index.xml',
        '/sitemap/sitemap.xml'
    ];

    for (const path of commonPaths) {
        const url = `${protocol}://${domain}${path}`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'User-Agent': 'EnvelopeBot/1.0' }
            });

            clearTimeout(timeout);

            if (res.ok && res.headers.get('content-type')?.includes('xml')) {
                // Try to parse basic modification time if possible, but for now just existence
                // If we really want lastmod, we'd parse the XML
                return { exists: true };
            }
        } catch (e) {
            // ignore
        }
    }

    return { exists: false };
}
