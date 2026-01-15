'use client';

import { useState, useEffect } from 'react';
import { hqStyles } from './SharedStyles';
import { ExternalLink, Maximize2, RefreshCw, AlertCircle, Globe } from 'lucide-react';

interface WebsitePreviewProps {
    url: string;
    screenshotUrl?: string | null;
}

export default function WebsitePreview({ url, screenshotUrl }: WebsitePreviewProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Handle missing or invalid URL
    if (!url) {
        return (
            <div className={hqStyles.card}>
                <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b border-gray-200 rounded-t-xl">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    </div>
                    <div className="flex-1 mx-4 bg-white rounded-md h-6 flex items-center px-3 text-xs text-gray-400 shadow-sm">
                        No website URL
                    </div>
                </div>
                <div className="aspect-video bg-gray-50 flex items-center justify-center rounded-b-xl">
                    <div className="text-center">
                        <Globe size={32} className="text-gray-300 mx-auto mb-2" />
                        <span className="text-xs text-gray-400 block">No website URL available</span>
                    </div>
                </div>
            </div>
        );
    }

    let hostname = 'website';
    try {
        hostname = new URL(url).hostname;
    } catch (e) {
        // Invalid URL
    }

    // Generate screenshot URL using free service
    // Options: microlink, urlbox, screenshotapi, etc.
    // Using microlink's free tier for simplicity
    const getScreenshotUrl = () => {
        if (screenshotUrl) return screenshotUrl;
        // Use microlink screenshot API (free tier)
        const encodedUrl = encodeURIComponent(url);
        return `https://api.microlink.io/?url=${encodedUrl}&screenshot=true&meta=false&embed=screenshot.url`;
    };

    // For display, use a simple approach with iframe fallback
    const [displayUrl, setDisplayUrl] = useState<string | null>(null);

    useEffect(() => {
        // Try to load screenshot from microlink
        const fetchScreenshot = async () => {
            try {
                const encodedUrl = encodeURIComponent(url);
                const response = await fetch(`https://api.microlink.io/?url=${encodedUrl}&screenshot=true&meta=false`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success' && data.data?.screenshot?.url) {
                        setDisplayUrl(data.data.screenshot.url);
                        setImageLoaded(true);
                    } else {
                        setImageError(true);
                    }
                } else {
                    setImageError(true);
                }
            } catch (e) {
                console.error('[WebsitePreview] Screenshot fetch failed:', e);
                setImageError(true);
            }
        };

        if (url) {
            fetchScreenshot();
        }
    }, [url]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setImageError(false);
        setImageLoaded(false);
        setDisplayUrl(null);

        try {
            const encodedUrl = encodeURIComponent(url);
            const response = await fetch(`https://api.microlink.io/?url=${encodedUrl}&screenshot=true&meta=false&force=true`);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.data?.screenshot?.url) {
                    setDisplayUrl(data.data.screenshot.url);
                    setImageLoaded(true);
                } else {
                    setImageError(true);
                }
            } else {
                setImageError(true);
            }
        } catch (e) {
            setImageError(true);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className={hqStyles.card}>
            {/* Browser Chrome */}
            <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b border-gray-200 rounded-t-xl">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4 bg-white rounded-md h-6 flex items-center px-3 text-xs text-gray-500 truncate shadow-sm">
                    {hostname}
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded transition"
                    title="Refresh screenshot"
                >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 p-1 rounded transition">
                    <ExternalLink size={14} />
                </a>
            </div>

            {/* Screenshot Area */}
            <div className="relative aspect-video bg-gray-50 flex items-center justify-center overflow-hidden group rounded-b-xl">
                {/* Loading State */}
                {!imageLoaded && !imageError && (
                    <div className="text-center">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                            <Globe size={32} className="text-gray-300" />
                            <span className="text-xs text-gray-400">Loading preview...</span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {imageError && (
                    <div className="text-center">
                        <AlertCircle size={32} className="text-gray-300 mx-auto mb-2" />
                        <span className="text-xs text-gray-400 block">Couldn&apos;t capture preview</span>
                        <button
                            onClick={handleRefresh}
                            className="text-xs text-indigo-500 hover:underline mt-2"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Screenshot Image */}
                {displayUrl && (
                    <img
                        src={displayUrl}
                        alt={`Screenshot of ${hostname}`}
                        className="w-full h-full object-cover object-top"
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageError(true)}
                    />
                )}

                {/* Overlay CTA on hover */}
                {imageLoaded && (
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary shadow-lg">
                            <Maximize2 size={16} className="mr-2" /> Open Website
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
