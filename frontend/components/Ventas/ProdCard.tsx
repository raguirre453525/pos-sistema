
import { Heart, ShoppingCart, Star, Sun, Moon } from 'lucide-react';
export interface InventoryItemProps {
  name: string;
  image: string;
  category: string;
  stock: number;
  price: number;
}
const ProdCard = ({ name, image, category, stock, price }: InventoryItemProps) => {
            return (
    <div className={`
      max-w-sm mx-auto rounded-xl border border-border bg-card text-foreground shadow-lg hover:shadow-xl 
      transition-all duration-300 overflow-hidden group transform hover:scale-[1.02]`}>
      
      <div className="relative aspect-square overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />             
      </div>
    
      <div className="p-6">
        <p className={`text-xs uppercase tracking-wider font-semibold mb-2 text-muted-foreground`}>
          {category}
        </p>
        <h3 className="font-bold text-xl mb-3 leading-tight line-clamp-2">
          {name}
        </h3>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-red-500">
                  ${price}
                </span>
          </div>
        </div>
        <button
          type="button"
          className={`
            w-full py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 
            flex items-center justify-center space-x-2 bg-primary text-primary-foreground hover:opacity-90
          `}
        >
          <ShoppingCart size={20} />
          <span>Agregar</span>
        </button>
      </div>
    </div>
  );
};
    

export default ProdCard