'use client';

import { hqStyles } from './SharedStyles';
import { ExternalLink, Maximize2 } from 'lucide-react';

interface WebsitePreviewProps {
    url: string;
}

export default function WebsitePreview({ url }: WebsitePreviewProps) {
    const hostname = new URL(url).hostname;

    return (
        <div className={hqStyles.card}>
            <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4 bg-white rounded-md h-6 flex items-center px-3 text-xs text-gray-500 truncate shadow-sm">
                    {hostname}
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
                    <ExternalLink size={14} />
                </a>
            </div>
            <div className="relative aspect-video bg-indigo-50 flex items-center justify-center overflow-hidden group">
                {/* Placeholder for screenshot */}
                <div className="text-center">
                    <span className="text-indigo-200 text-6xl font-bold opacity-20">PREVIEW</span>
                </div>

                {/* Overlay CTA */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary shadow-lg">
                        <Maximize2 size={16} className="mr-2" /> Open Website
                    </a>
                </div>
            </div>
        </div>
    );
}
