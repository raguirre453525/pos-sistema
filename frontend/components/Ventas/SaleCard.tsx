"use client";

import { ShoppingCart, Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  buttonText = "Agregar",
  onAdd,
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
      onClick={() => {
        if (!isOut && onAdd) onAdd();
      }}
      className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow group ${
        isOut ? "opacity-60 pointer-events-none" : "cursor-pointer"
      }`}
    >
      {/* Image - fixed height 128px for uniformity */}
      <div className="relative h-32 bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolved!}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <Package className="h-7 w-7 opacity-50" />
            <span className="text-sm font-semibold tracking-tight">{initials}</span>
          </div>
        )}
        {topBadge && !isOut && (
          <span className="absolute top-2 right-2 bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-sm">
            {topBadge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {subtitle && (
          <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider font-medium">
            {subtitle}
          </Badge>
        )}
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]" title={name}>
          {name}
        </h3>
        {sku && <span className="text-xs text-muted-foreground font-mono line-clamp-1">{sku}</span>}

        {savingText && (
          <span className="w-fit bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-md">
            {savingText}
          </span>
        )}

        {stockText && (
          <span
            className={`text-xs ${
              stockVariant === "out"
                ? "text-red-600 font-medium"
                : stockVariant === "low"
                ? "text-amber-600 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {stockText}
          </span>
        )}

        <div className="flex items-center gap-2 mt-auto flex-wrap">
          <span className="text-base font-semibold text-foreground">${Number(price).toLocaleString("es-AR")}</span>
          {originalPrice != null && originalPrice > price && (
            <span className="text-xs line-through text-muted-foreground">
              ${Number(originalPrice).toLocaleString("es-AR")}
            </span>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          disabled={isOut}
          onClick={(e) => {
            e.stopPropagation();
            if (!isOut && onAdd) onAdd();
          }}
          className="w-full mt-3 rounded-md"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {isOut ? "Sin stock" : buttonText}
        </Button>
      </div>
    </div>
  );
}
