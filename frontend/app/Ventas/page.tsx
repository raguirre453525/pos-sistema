import ProdCard from '@/components/Ventas/ProdCard'
import { MOCK_INVENTORY } from '@/constants/inventory'; 
const page = () => {
  return (
    <main className="min-h-screen bg-gray-50 p-4 flex flex-col gap-6">
      <h1 className="text-gray-700 text-2xl">VENTAS</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 p-6 py-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {MOCK_INVENTORY.map((stat, index) => (
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

        <div className="lg:col-span-1 bg-white h-96 rounded-2xl border border-gray-200 shadow-sm p-6">
          
        </div>
      </div>
      

    </main>
  )
}

export default page