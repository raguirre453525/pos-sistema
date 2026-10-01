"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, CheckCircle } from "lucide-react";
import { getLowStock } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchLow = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLowStock(5);
      setCount(data.length);
    } catch {
      // silent — keep previous count
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLow();
    const id = setInterval(() => {
      void fetchLow();
    }, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLow]);

  const handleViewInventory = () => {
    setOpen(false);
    router.push("/Inventario?filter=lowStock");
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void fetchLow();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificaciones" className="relative rounded-full size-11 lg:size-9">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Notificaciones
          </span>
          {count > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{count}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />

        {loading && count === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : count === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">Sin notificaciones</p>
            <p className="text-xs text-muted-foreground">Todo el stock está al día</p>
          </div>
        ) : (
          <div className="px-4 py-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold leading-tight">
                  {count} producto{count === 1 ? "" : "s"} con stock bajo
                </p>
                <p className="text-xs text-muted-foreground">Hay productos que necesitan reposición</p>
              </div>
            </div>
            <Button size="sm" className="w-full mt-3 rounded-md" onClick={handleViewInventory}>
              Ver en Inventario →
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
