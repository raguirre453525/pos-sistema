"use client";

import { Package } from "lucide-react";
import { useState } from "react";
import { API_URL } from "@/lib/api";

export interface SaleCardProps {
  name: string;
  imageUrl?: string | null;
  subtitle?: string;
  sku?: string;
  stockText?: string | null;
  stockVariant?: "out" | "low" | "ok";
  price: number;
  originalPrice?: number | null;
  topBadge?: string | null;
  savingText?: string | null;
  disabled?: boolean;
  buttonText?: string;
  onAdd?: () => void;
}

function resolveImage(src?: string | null): string | null {
  if (!src) return null;
  // Static public assets (e.g. /img-prod.webp) must not be prefixed with API_URL
  if (src === "/img-prod.webp" || src.startsWith("/_next") || src.startsWith("/img/")) return src;
  if (src.startsWith("/")) return `${API_URL}${src}`;
  return src;
}

export default function SaleCard({
  name,
  imageUrl,
  subtitle,
  sku,
  stockText,
  stockVariant,
  price,
  originalPrice,
  topBadge,
  savingText,
  disabled,
  onAdd,
  // buttonText kept in props for compat but not rendered — card is fully clickable
}: SaleCardProps) {
  const [imgError, setImgError] = useState(false);
  const resolved = resolveImage(imageUrl);
  const showImage = !!resolved && !imgError;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "PR";
  const isOut = !!disabled;

  return (
    <div
      role="button"
      tabIndex={isOut ? -1 : 0}
      aria-disabled={isOut}
      onClick={() => {
        if (!isOut && onAdd) onAdd();
      }}
      onKeyDown={(e) => {
        if (isOut || !onAdd) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAdd();
        }
      }}
      className={`group relative flex h-full min-h-[108px] gap-3 rounded-lg border border-border bg-card p-3 text-foreground shadow-sm transition-all duration-100 select-none overflow-hidden ${
        isOut
          ? "opacity-55 pointer-events-none"
          : "cursor-pointer hover:border-primary/20 hover:shadow-sm hover:bg-accent/20 active:scale-[0.98] active:ring-2 active:ring-primary/15 active:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }`}
    >
      {/* Left: text content */}
      <div className="flex min-w-0 flex-1 flex-col pr-1">
        <h3
          className="line-clamp-2 text-[12.5px] font-semibold leading-[1.35] tracking-tight min-h-[2.2rem] break-words"
          title={name}
        >
          {name}
        </h3>
        {subtitle && (
          <span className="mt-1 text-[11px] leading-[1.3] text-muted-foreground line-clamp-2" title={subtitle}>
            {subtitle}
          </span>
        )}

        {/* Bottom block: price + SKU/stock — stays at bottom, not floating */}
        <div className="mt-auto flex flex-col gap-0.5 pt-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[15px] font-bold leading-none tracking-tight">
              ${Number(price).toLocaleString("es-AR")}
            </span>
            {originalPrice != null && originalPrice > price && (
              <span className="text-[11px] leading-none line-through text-muted-foreground">
                ${Number(originalPrice).toLocaleString("es-AR")}
              </span>
            )}
          </div>

          {savingText && (
            <span className="text-[10px] font-medium leading-none text-emerald-700 dark:text-emerald-400 line-clamp-1">
              {savingText}
            </span>
          )}

          {sku && (
            <span className="font-mono text-[11px] leading-none text-muted-foreground line-clamp-1" title={sku}>
              {sku}
            </span>
          )}
          {stockText && (
            <span
              className={`text-[11px] leading-none line-clamp-1 ${
                stockVariant === "out"
                  ? "text-red-600 dark:text-red-400 font-medium"
                  : stockVariant === "low"
                    ? "text-amber-600 dark:text-amber-400 font-medium"
                    : "text-muted-foreground"
              }`}
            >
              {stockText}
            </span>
          )}
        </div>
      </div>

      {/* Right: 50x50 thumbnail — uniform, object-contain, neutral bg */}
      <div className="h-[50px] w-[50px] shrink-0 overflow-hidden rounded-md border border-border bg-white dark:bg-muted flex items-center justify-center p-1">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolved!}
            alt={name}
            className="h-full w-full object-contain object-center"
            onError={() => setImgError(true)}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
            <Package className="h-5 w-5 opacity-50" />
            <span className="text-[10px] font-semibold leading-none tracking-tight">{initials}</span>
          </div>
        )}
      </div>

      {/* Minimal neutral badge for COMBO/PROMO — soft, not red */}
      {topBadge && !isOut && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-muted border border-border px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide text-muted-foreground">
          {topBadge}
        </span>
      )}
    </div>
  );
}
