import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CartBoxProps {
  image: string;
  name: string;
  price: number;
  quantity?: number;
  stock?: number;
  onInc?: () => void;
  onDec?: () => void;
  onRemove?: () => void;
}

export default function CartBox({ image, name, price, quantity = 1, onInc, onDec, onRemove }: CartBoxProps) {
  const lineTotal = price * quantity;
  return (
    <div className="flex items-center justify-between gap-3 p-3 mb-3 rounded-xl border border-border bg-muted">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border bg-card shrink-0">
          <Image src={image} alt={name} fill className="object-cover" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-foreground line-clamp-1 leading-tight">{name}</span>
          <span className="text-xs text-muted-foreground">
            ${Number(price).toLocaleString("es-AR")} x {quantity} = ${Number(lineTotal).toLocaleString("es-AR")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="outline" size="icon-sm" className="h-7 w-7 rounded-full" onClick={onDec} aria-label="Decrementar">
          <Minus className="h-3 w-3" />
        </Button>
        <span className="text-sm font-semibold w-6 text-center">{quantity}</span>
        <Button variant="outline" size="icon-sm" className="h-7 w-7 rounded-full" onClick={onInc} aria-label="Incrementar">
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
