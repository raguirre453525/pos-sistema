import { ShoppingCart, Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export interface InventoryItemProps {
  name: string;
  image: string;
  category: string;
  stock: number;
  price: number;
  disabled?: boolean;
  onAdd?: () => void;
}

const ProdCard = ({ name, image, category, stock, price, disabled, onAdd }: InventoryItemProps) => {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "PR";
  const isOut = stock === 0 || !!disabled;
  const isLow = stock > 0 && stock <= 5;

  return (
    <div
      onClick={() => {
        if (!isOut && onAdd) onAdd();
      }}
      className={`max-w-sm mx-auto rounded-xl border border-border bg-card text-foreground shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group transform hover:scale-[1.02] flex flex-col ${
        isOut ? "opacity-50 pointer-events-none" : "cursor-pointer"
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-muted flex items-center justify-center">
        {!imgError ? (
          <Image
            src={image}
            alt={name}
            width={300}
            height={300}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 bg-muted"
            onError={() => setImgError(true)}
          />
        ) : null}
        {imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-800 text-zinc-100 gap-2">
            <Package className="h-8 w-8 opacity-60" />
            <span className="text-lg font-black tracking-widest">{initials}</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <Badge variant="secondary" className="w-fit mb-2 text-[10px] uppercase tracking-wider">
          {category}
        </Badge>
        <h3 className="font-bold text-base mb-2 leading-tight line-clamp-2 min-h-[2.5rem]">{name}</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xl font-bold text-red-500">${Number(price).toLocaleString("es-AR")}</span>
          {isOut ? (
            <Badge variant="outline" className="text-[11px] border-red-200 bg-red-50 text-red-700">
              Sin stock
            </Badge>
          ) : isLow ? (
            <Badge variant="outline" className="text-[11px] border-red-300 text-red-600">
              ¡Poco stock: {stock}
            </Badge>
          ) : null}
        </div>
        {!isOut && !isLow && <div className="text-xs text-muted-foreground mb-3">Stock: {stock}</div>}
        {isLow && <div className="text-xs text-muted-foreground mb-3">Stock: {stock}</div>}
        <button
          type="button"
          disabled={isOut}
          onClick={(e) => {
            e.stopPropagation();
            if (!isOut && onAdd) onAdd();
          }}
          className={`mt-auto w-full py-2.5 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
            isOut ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          <ShoppingCart size={18} />
          <span>{isOut ? "Sin stock" : "Agregar"}</span>
        </button>
      </div>
    </div>
  );
};

export default ProdCard;
