import Image from "next/image"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CartBoxProps {
  image: string;
  name: string;
  price: number;
  quantity?: number;
  onInc?: () => void;
  onDec?: () => void;
  onRemove?: () => void;
}

export default function CartBox({ image, name, price, quantity = 1, onInc, onDec, onRemove }: CartBoxProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 mb-3 rounded-xl border border-border bg-muted">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border bg-card">
          <Image 
            src={image} 
            alt={name} 
            fill 
            className="object-cover" 
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
            {name}
          </span>
          <span className="text-xs text-muted-foreground">
            ${price.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={onDec}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="text-sm font-semibold w-4 text-center">{quantity}</span>
        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={onInc}>
          <Plus className="h-3 w-3" />
        </Button>
        {onRemove && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRemove}>
            ×
          </Button>
        )}
      </div>
    </div>
  )
}
