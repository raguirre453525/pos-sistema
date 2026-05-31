"use client"
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useTheme } from "next-themes";

interface SideBarLogoProps {
    isExpanded: boolean
}

const SideBarLogo = ( { isExpanded = true }: SideBarLogoProps) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  
  const logoSrc = theme === 'dark' ? "/logo_dark.jpg" : "/logo.png";

  return (
      <Link href="/Dashboard">
        <div className="flex items-center p-3 rounded-full cursor-pointer transition-all duration-300 overflow-hidden">
          {isExpanded ? (
            <Image 
              src={mounted ? logoSrc : "/logo.png"} 
              alt="Logo" 
              width={170} 
              height={40} 
            />
          ) : (
            <div className="w-full flex justify-center">
              <Image 
                src={mounted ? logoSrc : "/logo.png"} 
                alt="Logo" 
                width={80} 
                height={40} 
                className="rounded-full" 
              />
            </div>
          )}
        </div>
      </Link>
  )   
}

export default SideBarLogo