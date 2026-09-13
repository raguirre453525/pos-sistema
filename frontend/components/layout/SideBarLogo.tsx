"use client"
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useTheme } from "next-themes";

interface SideBarLogoProps {
  isExpanded: boolean
}

const SideBarLogo = ({ isExpanded = true }: SideBarLogoProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = mounted && resolvedTheme === "dark" ? "/logo_dark.jpg" : "/logo.png";

  return (
    <Link href="/Dashboard" className="block" title={isExpanded ? undefined : "El Chorolqui"}>
      <div className={`bg-transparent flex items-center justify-center overflow-hidden ${isExpanded ? 'p-3' : 'p-1'}`}>
        {isExpanded ? (
          <Image
            src={logoSrc}
            alt="El Chorolqui"
            width={170}
            height={40}
            priority
            className="object-contain max-w-full bg-transparent"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-md bg-white dark:bg-white flex items-center justify-center overflow-hidden shadow-sm border border-border/50"
            aria-label="El Chorolqui"
          >
            <Image
              src={logoSrc}
              alt="El Chorolqui"
              width={32}
              height={32}
              className="object-contain w-8 h-8"
            />
          </div>
        )}
      </div>
    </Link>
  )
}

export default SideBarLogo
