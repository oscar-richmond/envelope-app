'use client';

import { Clock, X } from 'lucide-react';

interface SnoozeModalProps {
    onSnooze: (days: number) => void;
    onClose: () => void;
}

export function SnoozeModal({ onSnooze, onClose }: SnoozeModalProps) {
    const options = [
        { days: 2, label: '2 business days' },
        { days: 4, label: '4 business days' },
        { days: 7, label: '7 business days' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 m-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Clock size={20} className="text-amber-500" />
                        <h2 className="font-semibold text-gray-900">Snooze Follow-Up</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-6">
                    This follow-up will reappear in your queue after the selected time.
                </p>

                <div className="space-y-2">
                    {options.map(option => (
                        <button
                            key={option.days}
                            onClick={() => onSnooze(option.days)}
                            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-gray-700 font-medium"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
