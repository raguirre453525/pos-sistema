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
    <Link href="/Dashboard" className="block">
      <div className="bg-transparent flex items-center justify-center p-3 overflow-hidden">
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
          <div className="w-full flex justify-center bg-transparent">
            <Image
              src={logoSrc}
              alt="El Chorolqui"
              width={80}
              height={40}
              className="object-contain max-w-full bg-transparent"
            />
          </div>
        )}
      </div>
    </Link>
  )
}

export default SideBarLogo
