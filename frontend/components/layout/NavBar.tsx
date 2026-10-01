"use client";

import { Search, LogOut, ShieldCheck, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/layout/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const NavBar = ({
  isMobileNavOpen,
  onMobileNavToggle,
}: {
  isMobileNavOpen: boolean;
  onMobileNavToggle: () => void;
}) => {
  const pathname = usePathname();
  const isVentas = pathname === "/Ventas" || pathname?.startsWith("/Ventas/");
  const { role, user, loading, logout } = useAuth();

  const showSearch = !isVentas && role !== "SuperAdmin";

  return (
    <div className="w-full min-w-full max-w-none bg-white dark:bg-card text-foreground h-16 border-b border-slate-200/80 dark:border-border shadow-sm flex items-center justify-between px-4 sm:px-6 gap-3">
      <div className="w-full max-w-md hidden md:flex items-center">
        {/* Search visible only when !isVentas && role !== "SuperAdmin" — for SuperAdmin show Consola Maestro */}
        {showSearch ? (
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-muted-foreground" />
            </div>
            <input
              type="text"
              aria-label='Buscar productos'
              placeholder="Buscar..."
              className="block w-full min-h-11 lg:min-h-0 pl-10 pr-3 py-2 border border-border rounded-md bg-muted text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            />
          </div>
        ) : isVentas ? (
          <div className="text-sm font-medium text-muted-foreground">Ventas — POS</div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
            <ShieldCheck className="w-3.5 h-3.5" /> Consola Maestro
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label={isMobileNavOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isMobileNavOpen}
          aria-controls="main-navigation"
          title={isMobileNavOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={onMobileNavToggle}
          className="shrink-0 size-11 lg:size-9"
        >
          {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="truncate text-sm font-medium text-muted-foreground">
          {isVentas ? "Ventas — POS" : "MetraTC"}
        </span>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <NotificationBell />
        {/* Profile block — clean: fullName once + SuperAdmin badge, no duplication */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <div className="hidden lg:flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[140px]">{user?.fullName || user?.username || (loading ? "Cargando…" : "No autenticado")}</span>
            {user?.role === "SuperAdmin" ? (
              <span className="text-[11px] font-medium tracking-wide uppercase bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-full px-2 py-0.5 mt-0.5">SuperAdmin</span>
            ) : user ? (
              <span className="text-xs text-slate-500 font-normal">
                {user.role === "Admin" ? "Dueño" : "Cajero"}
              </span>
            ) : null}
          </div>
          <div className="w-8 h-8 rounded-full bg-muted border border-border shrink-0 hidden sm:flex items-center justify-center text-[10px] font-bold text-muted-foreground">
            {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : user?.username ? user.username.slice(0, 2).toUpperCase() : "?"}
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout} className="rounded-full shrink-0 size-11 lg:size-9" disabled={loading}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        {/* Mobile profile — avatar + logout only */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
            {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : "?"}
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout} className="rounded-full shrink-0 size-11 lg:size-9" disabled={loading}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NavBar
