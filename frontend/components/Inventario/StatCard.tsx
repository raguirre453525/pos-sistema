import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    icon: LucideIcon;
    color: string;
}

const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => {
    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon size={24} strokeWidth={2} />
            </div>
            <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-semibold text-foreground">{value}</h3>
            </div>
        </div>
    );
};

export default StatCard;


