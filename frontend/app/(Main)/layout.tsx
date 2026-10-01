"use client";

import Navbar from "@/components/layout/NavBar";
import SideBar from "@/components/layout/SideBar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

function MainInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, loading } = useAuth();
  const [mobileNav, setMobileNav] = useState({ pathname, open: false });
  if (mobileNav.pathname !== pathname) {
    setMobileNav({ pathname, open: false });
  }
  const isMobileNavOpen = mobileNav.open;
  const isVentas = pathname === "/Ventas" || pathname?.startsWith("/Ventas");

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav({ pathname, open: false });
    };
    const desktopViewport = window.matchMedia("(min-width: 48rem)");
    const closeOnDesktop = () => {
      if (desktopViewport.matches) setMobileNav({ pathname, open: false });
    };

    window.addEventListener("keydown", closeOnEscape);
    desktopViewport.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      desktopViewport.removeEventListener("change", closeOnDesktop);
    };
  }, [isMobileNavOpen, pathname]);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  // Also handle case token exists but hydration failed and user still null after loading
  // token will be null after failed /me, so above covers it; if token present but user null briefly, keep spinner

  if (loading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-zinc-700 dark:border-t-white" />
          <span className="text-sm text-muted-foreground">Cargando sesión…</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm text-muted-foreground">Redirigiendo a login…</span>
          <span className="text-xs text-muted-foreground">No autenticado</span>
        </div>
      </div>
    );
  }

  // Optional: if token present but user still null (hydrating), show spinner until user loads
  // This avoids flashing Main with default role before real role arrives
  if (!user) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-zinc-700 dark:border-t-white" />
          <span className="text-sm text-muted-foreground">Validando token…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh w-full min-w-full max-w-none overflow-hidden bg-slate-100 dark:bg-zinc-900">
      {isMobileNavOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileNav({ pathname, open: false })}
          className="absolute inset-x-0 top-16 bottom-0 z-40 bg-black/40 md:hidden"
        />
      )}
      <SideBar isMobileNavOpen={isMobileNavOpen} />
      <div className="flex flex-1 flex-col min-w-0 w-full max-w-none overflow-hidden">
        <Navbar
          isMobileNavOpen={isMobileNavOpen}
          onMobileNavToggle={() => setMobileNav({ pathname, open: !isMobileNavOpen })}
        />
        <main className={`flex-1 min-h-0 w-full min-w-full max-w-none ${isVentas ? "overflow-hidden flex flex-col bg-white dark:bg-zinc-900" : "overflow-y-auto bg-slate-100/70 dark:bg-zinc-900/50"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MainInner>{children}</MainInner>;
}
