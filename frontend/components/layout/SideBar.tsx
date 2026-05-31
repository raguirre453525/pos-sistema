'use client'

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { NAV_ITEMS } from "@/constants/navigation";
import NavItem from "./NavItem";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SideBarLogo from "./SideBarLogo"
import ModeToggle from "../ModeToggle";




const SideBar = () => {

  const pathname = usePathname()
  
  const [isExpanded, setIsExpanded] = useState(true)

  return (


    

    <ul className={`relative h-full bg-card border-r border-border flex flex-col p-4 gap-4 transition-all duration-300 ease-in-out ${ isExpanded ? 'w-64' : 'w-20' }` }>
    
            <SideBarLogo isExpanded={isExpanded} />
      
            {NAV_ITEMS.map((navigation) => (
                <NavItem key={navigation.path}
                 {...navigation} 
                 isActive={pathname === navigation.path}
                 isExpanded={isExpanded}
                 />
            ))}
      <div className="absolute bottom-8 -right-3 z-50">
        <button onClick={() => setIsExpanded(!isExpanded)} className="bg-card border border-border p-1 rounded-full shadow-md hover:bg-muted transition-colors text-foreground"
          title={isExpanded ? 'Minimizar' : 'Expandir'}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
      </div>
      <div className="mt-auto">
        <ModeToggle />
      </div>
    </ul>
    

   
  )
}

export default SideBar

