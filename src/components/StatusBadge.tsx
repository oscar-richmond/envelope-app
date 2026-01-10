export default function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { className: string; label?: string }> = {
        NEW: { className: "badge-info" },
        DRAFTED: { className: "badge-warning" },
        REVIEWED: { className: "badge-warning" },
        APPROVED: { className: "badge-success" },
        REJECTED: { className: "badge-error" },
        SENT: { className: "badge-info" },
        REPLIED: { className: "badge-success" },
    };

    const conf = config[status] || { className: "badge-neutral" };

    return (
        <span className={`badge ${conf.className}`}>
            {conf.label || status}
        </span>
    );
}
