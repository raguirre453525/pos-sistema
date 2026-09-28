'use client'

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { NAV_ITEMS } from "@/constants/navigation";
import NavItem from "./NavItem";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { PanelLeftClose, PanelLeftOpen, Building2, SlidersHorizontal, BarChart3 } from "lucide-react";
import SideBarLogo from "./SideBarLogo"
import ModeToggle from "../ModeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

const ADMIN_NAV = [
  { name: "Comercios", path: "/Admin/Negocios", icon: Building2 },
  { name: "Módulos y Licencias", path: "/Admin/Licencias", icon: SlidersHorizontal },
  { name: "Métricas Globales", path: "/Admin/Metricas", icon: BarChart3 },
] as const;




const SideBar = () => {

  const pathname = usePathname()
  const { role } = useAuth();
  const { flags } = useFeatureFlags();
  const [isExpanded, setIsExpanded] = useState(true)

  const filteredNav = useMemo(() => {
    if (role === "SuperAdmin") {
      return [...ADMIN_NAV];
    }
    return NAV_ITEMS.filter((item) => {
      const path = item.path;
      // Flags — account-level, apply to all roles
      if (!flags.moduloClientes && path === "/Clientes") return false;
      if (!flags.moduloPromos && path === "/Promociones") return false;
      if (!flags.moduloReportes && (path === "/Dashboard" || path === "/Reportes")) return false;
      // Role === User hides Configuracion, Dashboard, Reportes regardless of flag
      if (role === "User") {
        if (path === "/Configuracion" || path.startsWith("/Configuracion")) return false;
        if (path === "/Dashboard") return false;
        if (path === "/Reportes") return false;
      }
      return true;
    });
  }, [role, flags]);

  useEffect(() => {
    const saved = localStorage.getItem("metratc:sidebar:expanded");
    if (saved !== null) setIsExpanded(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("metratc:sidebar:expanded", String(isExpanded));
  }, [isExpanded]);

  return (
    <ul
      className={`h-full bg-white dark:bg-card border-r border-slate-200/80 dark:border-border shadow-sm flex flex-col transition-all duration-300 ease-in-out shrink-0 overflow-hidden left-0 ml-0 ${
        isExpanded ? "w-64 p-4 gap-4" : "w-16 p-2 gap-2"
      }`}
    >
      <li className="flex flex-col gap-1 flex-1 min-h-0">
        <SideBarLogo isExpanded={isExpanded} />

        {/* SuperAdmin active uses bg-slate-900 text-white dark:bg-white dark:text-slate-900 (or bg-indigo-600) — not red */}
        <nav className={`flex flex-col ${isExpanded ? "gap-1" : "gap-1.5 items-center"}`}>
          {filteredNav.map((navigation) => {
            const isActive = pathname === navigation.path;
            const isSuperAdminActive = role === "SuperAdmin" && isActive;
            // isSuperAdminActive determines bg-slate-900 vs bg-red-600
            void isSuperAdminActive;
            return (
              <NavItem
                key={navigation.path}
                {...navigation}
                isActive={isActive}
                isExpanded={isExpanded}
                isSuperAdmin={role === "SuperAdmin"}
              />
            );
          })}
        </nav>

        <div
          className={`mt-auto pt-3 border-t border-border flex ${
            isExpanded ? "items-center justify-between" : "flex-col items-center gap-2"
          }`}
        >
          {/* Orden: colapsado = toggle arriba, luna abajo centrados. Expandido = luna izq, toggle der */}
          {isExpanded ? (
            <>
              <ModeToggle />
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Ocultar menú"
                aria-label="Ocultar menú"
              >
                <PanelLeftClose size={18} strokeWidth={1.8} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Expandir menú"
                aria-label="Expandir menú"
              >
                <PanelLeftOpen size={18} strokeWidth={1.8} />
              </button>
              <ModeToggle />
            </>
          )}
        </div>
      </li>
    </ul>
    

   
  )
}

export default SideBar

