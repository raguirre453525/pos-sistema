'use client'

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { NAV_ITEMS } from "@/constants/navigation";
import NavItem from "./NavItem";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import SideBarLogo from "./SideBarLogo"
import ModeToggle from "../ModeToggle";




const SideBar = () => {

  const pathname = usePathname()
  
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem("metratc:sidebar:expanded");
    if (saved !== null) setIsExpanded(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("metratc:sidebar:expanded", String(isExpanded));
  }, [isExpanded]);

  return (
    <ul
      className={`h-full bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
        isExpanded ? "w-64 p-4 gap-4" : "w-16 p-2 gap-2"
      }`}
    >
      <li className="flex flex-col gap-1 flex-1 min-h-0">
        <SideBarLogo isExpanded={isExpanded} />

        <nav className={`flex flex-col ${isExpanded ? "gap-1" : "gap-1.5 items-center"}`}>
          {NAV_ITEMS.map((navigation) => (
            <NavItem
              key={navigation.path}
              {...navigation}
              isActive={pathname === navigation.path}
              isExpanded={isExpanded}
            />
          ))}
        </nav>

        <div
          className={`mt-auto pt-3 border-t border-border flex ${
            isExpanded ? "items-center justify-between" : "flex-col items-center gap-2"
          }`}
        >
          {/* Orden: colapsado = toggle arriba, luna abajo centrados. Expandido = luna izq, toggle der */}
          {isExpanded ? (
            <>
              <ModeToggle />
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Ocultar menú"
                aria-label="Ocultar menú"
              >
                <PanelLeftClose size={18} strokeWidth={1.8} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Expandir menú"
                aria-label="Expandir menú"
              >
                <PanelLeftOpen size={18} strokeWidth={1.8} />
              </button>
              <ModeToggle />
            </>
          )}
        </div>
      </li>
    </ul>
    

   
  )
}

export default SideBar

