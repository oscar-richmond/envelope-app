import { AlertTriangle, CheckCircle, Search, Calendar, Globe, Smartphone } from 'lucide-react';

export default function AnalysisCard({ lead }: { lead: any }) {
    const score = lead.stalenessScore;
    const confidence = lead.scoreConfidence;

    // Parse reasons
    let reasons: string[] = [];
    try {
        reasons = lead.scoreReasons ? JSON.parse(lead.scoreReasons) : [];
    } catch (e) {
        if (lead.scoreReasons) reasons = [lead.scoreReasons];
    }

    const scoreColor = score < 30 ? 'text-green-600' : score < 60 ? 'text-yellow-600' : 'text-red-600';
    const borderColor = score < 30 ? 'border-green-200' : score < 60 ? 'border-yellow-200' : 'border-red-200';
    const bgColor = score < 30 ? 'bg-green-50' : score < 60 ? 'bg-yellow-50' : 'bg-red-50';

    const formatDate = (d: Date | string | null) => d ? new Date(d).toLocaleDateString() : 'N/A';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Search size={18} className="text-gray-400" />
                    Website Analysis
                </h3>
                <span className="text-xs text-gray-400">
                    Last Checked: {formatDate(lead.lastAnalyzedAt)}
                </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Score Column */}
                <div className={`col-span-1 rounded-lg p-6 flex flex-col items-center justify-center border ${borderColor} ${bgColor}`}>
                    <div className={`text-5xl font-bold mb-2 ${scoreColor}`}>{score}</div>
                    <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Staleness Score</div>
                    <div className="mt-2 text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                        Confidence: {confidence}
                    </div>
                </div>

                {/* Reasons Column */}
                <div className="col-span-2">
                    <h4 className="font-medium text-gray-900 mb-3">Detected Signals</h4>
                    {reasons.length > 0 ? (
                        <ul className="space-y-2 mb-6">
                            {reasons.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                    <AlertTriangle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                                    {r}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400 text-sm mb-6">No specific staleness signals detected yet.</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <span className="block text-gray-400 mb-1 flex items-center gap-1"><Calendar size={12} /> Copyright</span>
                            <span className="font-semibold text-gray-700">{lead.copyrightYear || 'Not found'}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <span className="block text-gray-400 mb-1 flex items-center gap-1"><Smartphone size={12} /> Mobile</span>
                            <span className="font-semibold text-gray-700">
                                {lead.metaViewport ? 'Present' : 'Legacy'}
                            </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <span className="block text-gray-400 mb-1 flex items-center gap-1"><Globe size={12} /> Sitemap</span>
                            <span className="font-semibold text-gray-700">
                                {lead.sitemapLastMod ? formatDate(lead.sitemapLastMod) : (lead.hasSitemap ? 'Found' : 'Missing')}
                            </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <span className="block text-gray-400 mb-1 flex items-center gap-1"><Calendar size={12} /> Blog Post</span>
                            <span className="font-semibold text-gray-700">{formatDate(lead.blogLastPost)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
