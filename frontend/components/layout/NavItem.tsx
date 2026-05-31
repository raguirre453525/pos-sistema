import { LucideIcon } from 'lucide-react';
import Link from 'next/link'

interface NavItemProps {
  name: string;
  icon: LucideIcon;
  path: string;
  isActive: boolean;
  isExpanded?: boolean;
}

const NavItem = ({ name, icon: Icon, path, isActive, isExpanded = true }: NavItemProps) => {
  return (
    
      <Link href={path}>
        <div className={`flex items-center gap-3 p-3 rounded-full cursor-pointer transition-all duration-300 ease-in-out px-4 py-3 ${
        isActive 
        ? 'bg-red-500 text-white shadow-sm translate-x-5' 
        : 'text-foreground hover:bg-muted translate-x-0'
      }${!isExpanded ? 'justify-center px-0' : ''}
      `}>
        <Icon size={20} strokeWidth={2} /> 
        {isExpanded && <span className="font-medium">{name}</span>}
      </div>
      </Link>
      
    
  )


}

export default NavItem