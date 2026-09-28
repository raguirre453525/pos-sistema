"use client"
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useTheme } from "next-themes";
import { Store, ShoppingBag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SideBarLogoProps {
  isExpanded: boolean
}

const SideBarLogo = ({ isExpanded = true }: SideBarLogoProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { role, businessId, businessName, user } = useAuth();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = mounted && resolvedTheme === "dark" ? "/logo_dark.jpg" : "/logo.png";
  const isSystemBrand = role === "SuperAdmin" || businessId == null || user?.businessId == null;
  // Prefer JWT-derived businessName, then user profile; fallback to neutral placeholder — never hardcoded business name
  const displayBusinessName = (businessName ?? user?.businessName ?? "").trim() || "Mi Comercio";

  if (isSystemBrand) {
    return (
      <Link href="/Dashboard" className="block" title={isExpanded ? "MetraTC POS" : "MetraTC"}>
        <div className={`bg-transparent flex items-center overflow-hidden ${isExpanded ? 'p-3 gap-2.5' : 'p-1 justify-center'}`}>
          {isExpanded ? (
            <>
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0 shadow-sm">
                <Store className="w-4 h-4 text-white dark:text-slate-900" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">MetraTC POS</span>
            </>
          ) : (
            <div
              className="w-9 h-9 rounded-md bg-slate-900 dark:bg-white flex items-center justify-center overflow-hidden shadow-sm border border-border/50"
              aria-label="MetraTC POS"
            >
              <Store className="w-5 h-5 text-white dark:text-slate-900" />
            </div>
          )}
        </div>
      </Link>
    )
  }

  // Business brand (Admin / Cajero con negocio)
  return (
    <Link href="/Dashboard" className="block" title={isExpanded ? displayBusinessName : displayBusinessName}>
      <div className={`bg-transparent flex items-center justify-center overflow-hidden ${isExpanded ? 'p-3' : 'p-1'}`}>
        {isExpanded ? (
          <div className="flex items-center gap-2.5 w-full">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0 shadow-sm">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">{displayBusinessName}</span>
              <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground truncate">POS</span>
            </div>
          </div>
        ) : (
          <div
            className="w-9 h-9 rounded-md bg-white dark:bg-white flex items-center justify-center overflow-hidden shadow-sm border border-border/50"
            aria-label={displayBusinessName}
          >
            <Image
              src={logoSrc}
              alt={displayBusinessName}
              width={32}
              height={32}
              className="object-contain w-8 h-8"
            />
          </div>
        )}
      </div>
    </Link>
  )
}

export default SideBarLogo
