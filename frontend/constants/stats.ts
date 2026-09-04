import { LucideIcon, DollarSign, ShoppingBag, Package, Clock } from 'lucide-react';

export interface StatItem {
    title: string;
    value: string;
    icon: LucideIcon;
    color: string; 
}

export interface StatInv {
    title: string;
    value: string;
    icon: LucideIcon;
    color: string; 
}

export const STATS_DATA: StatItem[] = [
    {
        title: "Ventas de hoy",
        value: "24",
        icon: ShoppingBag,
        color: "bg-muted text-foreground border border-border",
    },
    {
        title: "Total facturado",
        value: "$125,400.00",
        icon: DollarSign,
        color: "bg-muted text-foreground border border-border",
    },
    {
        title: "Productos vendidos",
        value: "87",
        icon: Package,
        color: "bg-muted text-foreground border border-border",
    },
    {
        title: "Tiempo de caja",
        value: "05:42 hs",
        icon: Clock,
        color: "bg-muted text-foreground border border-border",
    },
];

export const INV_DATA: StatInv[] = [
    {
        title: "Valor Total de Activos",
        value: "$125,400,000.00",
        icon: Package,
        color: "bg-muted text-foreground border border-border",
    },
];


