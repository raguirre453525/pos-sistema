import ProdCard from '@/components/Ventas/ProdCard'
import CartBox from '@/components/Ventas/CartBox'
import { MOCK_BUSINESS } from '@/constants/inventory'; 
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
const page = () => {
  return (
    <main className="min-h-screen bg-background p-4 flex flex-col gap-6">
      <h1 className="text-foreground text-2xl">VENTAS</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 p-6 py-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {MOCK_BUSINESS.map((stat, index) => (
              <ProdCard 
                key={index}
                name={stat.name}
                image={stat.image}
                category={stat.category}
                stock={stat.stock}
                price={stat.price}
              />
            ))}
          </div>
        </div>
        
        <div className="lg:col-span-1 bg-card h-[calc(100vh-12rem)] rounded-2xl border border-border shadow-sm p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-foreground">FACTURA</h2>
          
          <div className="flex-1 overflow-y-auto pr-2">
            <CartBox 
              name="Producto A" 
              price={1500} 
              image="/img-prod.webp" 
            />
            <CartBox 
              name="Producto B" 
              price={2200} 
              image="/img-prod.webp" 
            />
          </div>
          
          <Button className="w-full mt-auto bg-red-600 hover:bg-red-800 text-white font-bold py-6 rounded-xl transition-all">
            Cobrar
          </Button>
        </div>
      </div>
      
    </main>
  )
}


export default page