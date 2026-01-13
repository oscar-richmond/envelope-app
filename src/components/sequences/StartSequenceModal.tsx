'use client';

/**
 * Phase 7: Start Sequence Modal
 * Select contact and schedule to start a sequence
 */

import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@/components/ui';

interface Contact {
    id: string;
    email: string;
    name?: string;
    role?: string;
}

interface Sequence {
    id: string;
    name: string;
    steps: { dayOffset: number }[];
}

interface StartSequenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string;
    companyName: string;
    contacts: Contact[];
    onStart?: (result: { enrollmentId: string }) => void;
}

export function StartSequenceModal({
    isOpen,
    onClose,
    companyId,
    companyName,
    contacts,
    onStart,
}: StartSequenceModalProps) {
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [selectedSequence, setSelectedSequence] = useState<string>('');
    const [selectedContact, setSelectedContact] = useState<string>('');
    const [scheduleWindow, setScheduleWindow] = useState({
        weekdaysOnly: true,
        startHour: 9,
        endHour: 17,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchSequences();
            if (contacts.length > 0) {
                setSelectedContact(contacts[0].id);
            }
        }
    }, [isOpen, contacts]);

    const fetchSequences = async () => {
        try {
            const res = await fetch('/api/sequences');
            const data = await res.json();
            if (data.success) {
                setSequences(data.sequences);
                if (data.sequences.length > 0) {
                    setSelectedSequence(data.sequences[0].id);
                }
            }
        } catch (err) {
            console.error('Failed to fetch sequences:', err);
        }
    };

    const handleStart = async () => {
        if (!selectedSequence || !selectedContact) return;

        const contact = contacts.find(c => c.id === selectedContact);
        if (!contact) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/sequences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    sequenceId: selectedSequence,
                    companyId,
                    contact: {
                        id: contact.id,
                        email: contact.email,
                        name: contact.name,
                    },
                    scheduleWindow,
                }),
            });

            const data = await res.json();

            if (data.success) {
                onStart?.(data.enrollment);
                onClose();
            } else {
                setError(data.error || 'Failed to start sequence');
            }
        } catch (err: any) {
            setError(err.message || 'Request failed');
        } finally {
            setLoading(false);
        }
    };

    const selectedSeq = sequences.find(s => s.id === selectedSequence);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalHeader>
                <h2 className="text-lg font-bold">Start Sequence</h2>
                <p className="text-sm text-slate-500">{companyName}</p>
            </ModalHeader>

            <ModalBody>
                <div className="space-y-6">
                    {/* Sequence Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Sequence
                        </label>
                        <select
                            value={selectedSequence}
                            onChange={(e) => setSelectedSequence(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {sequences.map(seq => (
                                <option key={seq.id} value={seq.id}>
                                    {seq.name} ({seq.steps.length} steps)
                                </option>
                            ))}
                        </select>

                        {selectedSeq && (
                            <div className="mt-2 flex gap-2">
                                {selectedSeq.steps.map((step, i) => (
                                    <span key={i} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded">
                                        Day {step.dayOffset}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Contact Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Contact
                        </label>
                        <div className="space-y-2">
                            {contacts.map(contact => (
                                <label
                                    key={contact.id}
                                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedContact === contact.id
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="contact"
                                        value={contact.id}
                                        checked={selectedContact === contact.id}
                                        onChange={(e) => setSelectedContact(e.target.value)}
                                        className="w-4 h-4 text-blue-500"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-900">
                                            {contact.name || contact.email}
                                        </div>
                                        {contact.role && (
                                            <div className="text-sm text-slate-500">{contact.role}</div>
                                        )}
                                        <div className="text-xs text-slate-400">{contact.email}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Schedule Window */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Sending Window
                        </label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={scheduleWindow.weekdaysOnly}
                                    onChange={(e) => setScheduleWindow({
                                        ...scheduleWindow,
                                        weekdaysOnly: e.target.checked,
                                    })}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-slate-600">Weekdays only</span>
                            </label>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <select
                                    value={scheduleWindow.startHour}
                                    onChange={(e) => setScheduleWindow({
                                        ...scheduleWindow,
                                        startHour: parseInt(e.target.value),
                                    })}
                                    className="px-2 py-1 border rounded"
                                >
                                    {[7, 8, 9, 10, 11].map(h => (
                                        <option key={h} value={h}>{h}:00</option>
                                    ))}
                                </select>
                                <span>to</span>
                                <select
                                    value={scheduleWindow.endHour}
                                    onChange={(e) => setScheduleWindow({
                                        ...scheduleWindow,
                                        endHour: parseInt(e.target.value),
                                    })}
                                    className="px-2 py-1 border rounded"
                                >
                                    {[15, 16, 17, 18, 19].map(h => (
                                        <option key={h} value={h}>{h}:00</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                            {error}
                        </div>
                    )}
                </div>
            </ModalBody>

            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={handleStart}
                    disabled={loading || !selectedSequence || !selectedContact}
                >
                    {loading ? 'Starting...' : 'Start Sequence'}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
