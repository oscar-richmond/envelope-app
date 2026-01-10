'use client';

import { useSearchParams, useParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Terminal, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function DebugPanel({ data }: { data?: any }) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const params = useParams();
    const isDebug = searchParams.get('debug') === '1';
    const [isOpen, setIsOpen] = useState(false);

    if (!isDebug) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-full">
            <div className="bg-gray-900 text-green-400 rounded-lg shadow-2xl border border-gray-700 overflow-hidden font-mono text-xs">
                <div
                    className="flex items-center justify-between p-2 bg-gray-800 cursor-pointer hover:bg-gray-700 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2 font-bold text-white">
                        <Terminal size={14} />
                        DEBUG_MODE
                    </div>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </div>

                {isOpen && (
                    <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
                        <div>
                            <h4 className="text-gray-500 mb-1 uppercase font-bold text-[10px]">Route Context</h4>
                            <div className="bg-black/50 p-2 rounded">
                                <p><span className="text-blue-400">Path:</span> {pathname}</p>
                                <p><span className="text-blue-400">Params:</span> {JSON.stringify(params)}</p>
                            </div>
                        </div>

                        {data && (
                            <div>
                                <h4 className="text-gray-500 mb-1 uppercase font-bold text-[10px]">Page Data Keys</h4>
                                <div className="bg-black/50 p-2 rounded">
                                    <ul className="list-disc pl-4 space-y-1">
                                        {Object.keys(data).map(k => (
                                            <li key={k}>
                                                {k}: <span className={data[k] ? 'text-green-400' : 'text-red-400'}>
                                                    {data[k] ? typeof data[k] === 'object' ? (Array.isArray(data[k]) ? `Array(${data[k].length})` : 'Object') : String(data[k]) : 'null/undefined'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-gray-700 text-center">
                            <span className="text-gray-500 italic">No secrets displayed.</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
