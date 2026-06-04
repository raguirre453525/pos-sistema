import { link } from 'fs';
import {LucideIcon } from 'lucide-react';
import Link from 'next/link';
interface ConfigBtnProps {
    link: string;
    title: string;
    icon: LucideIcon;
    color: string;
}

const ConfigBtn = ({ title, icon: Icon, color, link }: ConfigBtnProps) => {
    return (
        <Link href={link}>
            
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md hover:bg-muted transition-shadow duration-300 flex items-center gap-4 cursor-pointer">
                <div className={`p-3 mr-4 rounded-xl ${color} flex itemes-center justify-center`}>
                    <Icon size={48} strokeWidth={2} />
                </div>
                <span className="text-lg font-semibold">{title}</span>
                </div>
           
        </Link>
    );
};

export default ConfigBtn;
