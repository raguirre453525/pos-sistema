import { LucideIcon } from 'lucide-react';
import Link from 'next/link'

interface NavItemProps {
  name: string;
  icon: LucideIcon;
  path: string;
  isActive: boolean;
  isExpanded?: boolean;
  isSuperAdmin?: boolean;
}

const NavItem = ({ name, icon: Icon, path, isActive, isExpanded = true, isSuperAdmin = false }: NavItemProps) => {
  const isSuperAdminActive = isSuperAdmin && isActive;
  if (!isExpanded) {
    return (
      <Link href={path} title={name} aria-label={name}>
        <div
          className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg cursor-pointer transition-colors ${
            isSuperAdminActive
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : isActive
                ? "bg-red-600 text-white shadow-sm"
                : isSuperAdmin
                  ? "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          isSuperAdminActive
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm translate-x-1"
            : isActive
              ? "bg-red-600 text-white shadow-sm translate-x-1"
              : isSuperAdmin
                ? "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                : "text-foreground hover:bg-muted"
        }`}
      >
        <Icon size={20} strokeWidth={2} />
        <span className="font-medium">{name}</span>
      </div>
    </Link>
      
    
  )


}

export default NavItem
