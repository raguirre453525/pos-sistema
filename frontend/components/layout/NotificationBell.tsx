"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle } from "lucide-react";
import { getLowStock, type LowStockDto } from "@/lib/api";
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
  const [items, setItems] = useState<LowStockDto[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLow = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLowStock(5);
      setItems(data);
    } catch {
      // silent — keep previous items
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLow();
    const id = setInterval(() => { void fetchLow(); }, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLow]);

  const count = items.length;

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) fetchLow(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificaciones"
          className="relative rounded-full"
        >
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
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
              {count}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : count === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin notificaciones</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight line-clamp-1">{p.name}</span>
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                      ¡Poco stock!
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{p.sku}</span>
                    <span>·</span>
                    <span>
                      Stock <span className="font-semibold text-foreground">{p.stock}</span> / mín. {p.threshold}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/Inventario")}
                    className="mt-1 self-start text-xs font-medium text-primary hover:underline"
                  >
                    Ver en Inventario →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {count > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push("/Inventario")}
              >
                Ir a Inventario
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
