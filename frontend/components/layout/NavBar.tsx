import { Search } from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';

const NavBar = () => {
  return (
    <div className="bg-card text-foreground h-16 border-b border-border flex items-center justify-between px-6">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-muted-foreground" />
        </div>
        <input 
          type="text" 
          aria-label='Buscar productos'
          placeholder="Buscar..." 
          className="block w-full pl-10 pr-3 py-2 border border-border rounded-md bg-muted text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
        />
      </div>
      
      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-muted border border-border" />
      </div>
    </div>
  )
}

export default NavBar
