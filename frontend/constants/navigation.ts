import { LucideIcon, LayoutDashboard, ShoppingCart, Package, BarChart3, Settings, Bot, Users } from "lucide-react";

export interface NavigationItem {
    name: string;
    icon: LucideIcon;
    path: string;
}

export const NAV_ITEMS: NavigationItem[] = [
    { name: "ASISTENTE", icon: Bot, path: "/Asistente" },
    { name: "DASHBOARD", icon: LayoutDashboard, path: "/Dashboard" },
    { name: "VENTAS", icon: ShoppingCart, path: "/Ventas" },
    { name: "CLIENTES", icon: Users, path: "/Clientes" },
    { name: "INVENTARIO", icon: Package, path: "/Inventario" },
    { name: "REPORTES", icon: BarChart3, path: "/Reportes" },
    { name: "CONFIGURACION", icon: Settings, path: "/Configuracion" },

];

  export default NAV_ITEMS;