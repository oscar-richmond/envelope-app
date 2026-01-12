import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/company/[id]/screenshot
 * Generate website screenshot using external API
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const websiteUrl = searchParams.get('url');
        const refresh = searchParams.get('refresh') === 'true';

        if (!websiteUrl) {
            return NextResponse.json({ error: 'URL required' }, { status: 400 });
        }

        // Normalize URL
        let url = websiteUrl;
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }

        // Use microlink.io for free screenshot generation
        // Alternative: screenshotapi.net, urlbox.io, or self-hosted Playwright
        const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;

        const res = await fetch(screenshotUrl, {
            headers: {
                'Accept': 'application/json'
            },
            next: refresh ? { revalidate: 0 } : { revalidate: 86400 } // Cache for 24h unless refresh
        });

        if (!res.ok) {
            throw new Error('Screenshot service failed');
        }

        const data = await res.json();

        if (data.status === 'success' && data.data?.screenshot?.url) {
            return NextResponse.json({
                success: true,
                screenshotUrl: data.data.screenshot.url,
                title: data.data.title || null,
                description: data.data.description || null,
                logo: data.data.logo?.url || null,
                publisher: data.data.publisher || null
            });
        }

        return NextResponse.json({
            success: false,
            error: 'Could not capture screenshot'
        }, { status: 500 });

    } catch (e: any) {
        console.error('[Screenshot API] Error:', e);
        return NextResponse.json({
            success: false,
            error: e.message
        }, { status: 500 });
    }
}
