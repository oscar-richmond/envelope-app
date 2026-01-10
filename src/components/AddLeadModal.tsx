'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal, { ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AddLeadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const router = useRouter();
    const [formData, setFormData] = useState({
        companyName: '',
        websiteUrl: '',
        industry: '',
        location: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Simulate waiting for effect
            // await new Promise(resolve => setTimeout(resolve, 1000)); 

            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setFormData({ companyName: '', websiteUrl: '', industry: '', location: '' });
                onClose();
                router.refresh();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to add lead');
            }
        } catch (e) {
            console.error(e);
            alert('Error creating lead');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add New Lead"
            maxWidth="500px"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={loading}
                    >
                        Add Lead
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Company Name *"
                    required
                    placeholder="e.g. Acme Corp"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />

                <Input
                    label="Website URL *"
                    required
                    placeholder="example.com"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    helperText="We'll use this to find company info."
                />

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Industry"
                        placeholder="e.g. SaaS"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    />
                    <Input
                        label="Location"
                        placeholder="e.g. London"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                </div>
            </form>
        </Modal>
    );
}
