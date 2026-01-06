
'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, MapPin, Phone, Clock, Star, Globe, RefreshCw, Building2, TrendingUp, Activity, AlertCircle } from 'lucide-react';

interface ProfileData {
    id: number;
    displayName: string;
    displayNameSource: string;
    category: string | null;
    location: string | null;
    fullAddress: string | null;
    websiteUrl: string | null;
    phone: string | null;
    mapsUrl: string | null;
    businessStatus: string | null;
    openingHours: { weekdayDescriptions?: string[] } | null;
    rating: number | null;
    reviewCount: number | null;
    aiOneLiner: string | null;
    aiOverview: string | null;
    aiReputationSummary: string | null;
    signals: {
        staleness: { score: number | null; band?: string };
        financial: { score: number | null; band: string | null };
        leadOpportunity: { score: number | null; band: string | null };
    };
    emails: { email: string; name: string | null; role: string | null }[];
}

interface Props {
    prospectId: number;
    onClose: () => void;
    onAddToLeads?: () => void;
    onCompose?: () => void;
}

export function CompanyProfilePopup({ prospectId, onClose, onAddToLeads, onCompose }: Props) {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProfile();
    }, [prospectId]);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/prospects/${prospectId}/profile`);
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            setProfile(data);
            setError(null);
        } catch (err) {
            setError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetch(`/api/prospects/${prospectId}/profile/refresh`, { method: 'POST' });
            await fetchProfile();
        } finally {
            setRefreshing(false);
        }
    };

    const getStalenessBand = (score: number | null) => {
        if (score === null) return null;
        if (score >= 70) return { label: 'Outdated', color: 'text-red-600 bg-red-50' };
        if (score >= 40) return { label: 'Moderate', color: 'text-yellow-600 bg-yellow-50' };
        return { label: 'Fresh', color: 'text-green-600 bg-green-50' };
    };

    const getBandColor = (band: string | null) => {
        if (!band) return 'text-gray-500 bg-gray-50';
        const lower = band.toLowerCase();
        if (lower.includes('high') || lower.includes('strong')) return 'text-green-600 bg-green-50';
        if (lower.includes('medium') || lower.includes('moderate')) return 'text-yellow-600 bg-yellow-50';
        return 'text-gray-600 bg-gray-50';
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                        {loading ? 'Loading...' : profile?.displayName || 'Company Profile'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-6 space-y-4">
                        <div className="animate-pulse space-y-3">
                            <div className="h-6 bg-gray-100 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                            <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                            <div className="h-20 bg-gray-100 rounded"></div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="p-6 text-center">
                        <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500">{error}</p>
                        <button onClick={fetchProfile} className="mt-3 text-blue-600 hover:underline text-sm">
                            Try again
                        </button>
                    </div>
                ) : profile && (
                    <div className="p-4 space-y-6">
                        {/* Identity */}
                        <div>
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <Building2 className="text-gray-400" size={24} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xl font-semibold text-gray-900">{profile.displayName}</h3>
                                    {profile.category && (
                                        <p className="text-sm text-gray-500">{profile.category}</p>
                                    )}
                                    {profile.location && (
                                        <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                                            <MapPin size={12} /> {profile.location}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Rating */}
                            {profile.rating && (
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-yellow-500">
                                        <Star size={16} fill="currentColor" />
                                        <span className="font-medium">{profile.rating.toFixed(1)}</span>
                                    </div>
                                    {profile.reviewCount && (
                                        <span className="text-sm text-gray-400">
                                            ({profile.reviewCount.toLocaleString()} reviews)
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Quick Links */}
                            <div className="mt-3 flex gap-2">
                                {profile.websiteUrl && (
                                    <a
                                        href={profile.websiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                                    >
                                        <Globe size={14} /> Website
                                    </a>
                                )}
                                {profile.mapsUrl && (
                                    <a
                                        href={profile.mapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                                    >
                                        <MapPin size={14} /> Maps
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* AI Summary */}
                        {(profile.aiOneLiner || profile.aiOverview) && (
                            <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">About</h4>
                                {profile.aiOneLiner && (
                                    <p className="text-gray-900 font-medium">{profile.aiOneLiner}</p>
                                )}
                                {profile.aiOverview && (
                                    <p className="text-gray-600 text-sm mt-2 leading-relaxed">{profile.aiOverview}</p>
                                )}
                            </div>
                        )}

                        {/* Contact Info */}
                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Contact</h4>
                            <div className="space-y-2 text-sm">
                                {profile.websiteUrl && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Globe size={14} className="text-gray-400" />
                                        <a href={profile.websiteUrl} target="_blank" className="hover:text-blue-600 truncate">
                                            {profile.websiteUrl.replace(/^https?:\/\//, '')}
                                        </a>
                                    </div>
                                )}
                                {profile.phone && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Phone size={14} className="text-gray-400" />
                                        <span>{profile.phone}</span>
                                    </div>
                                )}
                                {profile.fullAddress && (
                                    <div className="flex items-start gap-2 text-gray-600">
                                        <MapPin size={14} className="text-gray-400 mt-0.5" />
                                        <span>{profile.fullAddress}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Opening Hours */}
                        {profile.openingHours?.weekdayDescriptions && (
                            <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Hours</h4>
                                <div className="space-y-1 text-sm text-gray-600">
                                    {profile.openingHours.weekdayDescriptions.map((day, i) => (
                                        <div key={i}>{day}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Internal Signals */}
                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Signals</h4>
                            <div className="space-y-2">
                                {profile.signals.staleness.score !== null && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Website Staleness</span>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStalenessBand(profile.signals.staleness.score)?.color}`}>
                                            {getStalenessBand(profile.signals.staleness.score)?.label} ({profile.signals.staleness.score})
                                        </span>
                                    </div>
                                )}
                                {profile.signals.financial.band && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Financial Activity</span>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getBandColor(profile.signals.financial.band)}`}>
                                            {profile.signals.financial.band}
                                        </span>
                                    </div>
                                )}
                                {profile.signals.leadOpportunity.band && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Lead Opportunity</span>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getBandColor(profile.signals.leadOpportunity.band)}`}>
                                            {profile.signals.leadOpportunity.band}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Emails */}
                        {profile.emails.length > 0 && (
                            <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Contacts</h4>
                                <div className="space-y-2">
                                    {profile.emails.slice(0, 3).map((e, i) => (
                                        <div key={i} className="text-sm">
                                            <div className="text-gray-900">{e.email}</div>
                                            {(e.name || e.role) && (
                                                <div className="text-gray-400 text-xs">
                                                    {e.name}{e.name && e.role && ' · '}{e.role}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                {!loading && profile && (
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-2">
                        {onAddToLeads && (
                            <button
                                onClick={onAddToLeads}
                                className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                            >
                                Add to Leads
                            </button>
                        )}
                        {onCompose && (
                            <button
                                onClick={onCompose}
                                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Compose
                            </button>
                        )}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Refresh profile"
                        >
                            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
