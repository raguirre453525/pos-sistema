'use client'

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { NAV_ITEMS } from "@/constants/navigation";
import NavItem from "./NavItem";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";





const SideBar = () => {

  const pathname = usePathname()
  
  const [isExpanded, setIsExpanded] = useState(true)

  return (


    

    <ul className={`relative h-full bg-white border-r border-gray-200 flex flex-col p-4 gap-4 transition-all duration-300 ease-in-out ${ isExpanded ? 'w-64' : 'w-20' }` }>



            <Link href="/Dashboard">
        <div className="flex items-center p-3 rounded-full cursor-pointer transition-all duration-300 overflow-hidden">
          {isExpanded ? (
            <Image src="/logo.png" alt="Logo" width={170} height={40} />
          ) : (
            <div className="w-full flex justify-center">
               <Image src="/logo.png" alt="Logo" width={80} height={40} className="rounded-full" />
            </div>
          )}
        </div>
      </Link>

            {NAV_ITEMS.map((navigation) => (
                <NavItem key={navigation.path}
                 {...navigation} 
                 isActive={pathname === navigation.path}
                 isExpanded={isExpanded}
                 />
            ))}
      <div className="absolute bottom-8 -right-3 z-50">
        <button onClick={() => setIsExpanded(!isExpanded)} className="bg-white border border-gray-200 p-1 rounded-full shadow-md hover:bg-gray-50 transition-colors text-gray-600"
          title={isExpanded ? 'Minimizar' : 'Expandir'}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
      </div>
      <div className="mt-auto p-2 rounded-full hover:bg-gray-100 transition-colors">


      </div>

    </ul>
    

   
  )
}

export default SideBar

