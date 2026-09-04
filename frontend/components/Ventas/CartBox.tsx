import { Minus, Plus, X, Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

function resolveImage(src?: string | null): string | null {
  if (!src) return null;
  if (src === "/img-prod.webp" || src.startsWith("/_next") || src.startsWith("/img/")) return src;
  if (src.startsWith("/")) return `${API_URL}${src}`;
  return src;
}

interface CartBoxProps {
  image?: string | null;
  name: string;
  price: number;
  quantity?: number;
  stock?: number;
  unit?: string | null;
  isSoldByWeight?: boolean;
  onInc?: () => void;
  onDec?: () => void;
  onQtyChange?: (raw: string) => void;
  onRemove?: () => void;
}

export default function CartBox({ image, name, price, quantity = 1, stock, unit, isSoldByWeight, onInc, onDec, onQtyChange, onRemove }: CartBoxProps) {
  const lineTotal = price * quantity;
  const isWeight = isSoldByWeight === true || (unit ?? "").toLowerCase() === "kg";
  const unitLabel = isWeight ? "kg" : "un.";
  const qtyDisplay = Number(quantity).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  const stockDisplay = stock != null ? Number(stock).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : undefined;
  const [imgError, setImgError] = useState(false);
  const resolved = resolveImage(image);
  const showImage = !!resolved && !imgError;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "PR";

  return (
    <div className="flex items-center justify-between gap-3 p-3 mb-3 rounded-xl border border-border bg-muted">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border bg-card shrink-0 flex items-center justify-center">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolved!} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : resolved === "/img-prod.webp" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/img-prod.webp" alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
              <Package className="h-5 w-5 opacity-50" />
              <span className="text-[10px] font-semibold leading-none">{initials}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-foreground line-clamp-1 leading-tight">{name}</span>
          <span className="text-xs text-muted-foreground">
            ${Number(price).toLocaleString("es-AR")} x {qtyDisplay} {unitLabel} = ${Number(lineTotal).toLocaleString("es-AR")}
          </span>
          {stockDisplay != null && <span className="text-[11px] text-muted-foreground">Stock: {stockDisplay} {unitLabel}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="outline" size="icon-sm" className="h-7 w-7 rounded-full" onClick={onDec} aria-label={isWeight ? "Restar 0.1 kg" : "Decrementar"}>
          <Minus className="h-3 w-3" />
        </Button>
        {onQtyChange ? (
          <input
            type="number"
            step={isWeight ? "0.1" : "1"}
            min={isWeight ? "0.1" : "1"}
            max={stock != null ? String(stock) : undefined}
            value={quantity}
            onChange={(e) => onQtyChange(e.target.value)}
            className="w-16 text-center text-sm font-semibold bg-card border border-input rounded h-7 px-1"
          />
        ) : (
          <span className="text-sm font-semibold w-14 text-center">{qtyDisplay} {unitLabel}</span>
        )}
        <Button variant="outline" size="icon-sm" className="h-7 w-7 rounded-full" onClick={onInc} aria-label={isWeight ? "Sumar 0.1 kg" : "Incrementar"}>
          <Plus className="h-3 w-3" />
        </Button>
        {onRemove && (
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-full ml-1" onClick={onRemove} aria-label="Quitar">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
