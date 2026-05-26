import { Search } from 'lucide-react';

const NavBar = () => {
  return (
    <div className="bg-white text-black h-16 border-b border-gray-200 flex items-center justify-between px-6">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input 
          type="text" 
          placeholder="Buscar..." 
          className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-full bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
        />
      </div>
      
      <div className="flex items-center gap-4">
       
        <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300" />
      </div>
    </div>
  )
}

export default NavBar