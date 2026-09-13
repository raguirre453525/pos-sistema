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
  if (!isExpanded) {
    return (
      <Link href={path} title={name} aria-label={name}>
        <div
          className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg cursor-pointer transition-colors ${
            isActive ? "bg-red-600 text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Icon size={20} strokeWidth={2} />
        </div>
      </Link>
    );
  }
  return (
    <Link href={path}>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-md cursor-pointer transition-all duration-200 ${
          isActive ? "bg-red-600 text-white shadow-sm translate-x-1" : "text-foreground hover:bg-muted"
        }`}
      >
        <Icon size={20} strokeWidth={2} />
        <span className="font-medium">{name}</span>
      </div>
    </Link>
      
    
  )


}

export default NavItem
