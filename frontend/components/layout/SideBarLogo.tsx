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

  // Tema sincronizado: transparent PNGs, sin recuadro blanco.
  // /logo.png = versión clara (para fondo claro), /logo_dark.png = versión oscura transparente (para fondo oscuro)
  // Fallback CSS: si no hay variante transparente, usar mix-blend.
  // TODO: reemplazar /public/logo.png por versión con fondo transparente exportada desde Figma si el parche no es perfecto
  const logoSrc = mounted && resolvedTheme === "dark" ? "/logo_dark.png" : "/logo.png";

  return (
    <Link href="/Dashboard" className="block">
      <div className="bg-transparent flex items-center justify-center p-2 transition-all duration-300 overflow-hidden">
        {isExpanded ? (
          <Image
            src={logoSrc}
            alt="El Chorolqui"
            width={170}
            height={40}
            priority
            className="h-10 w-auto object-contain bg-transparent mix-blend-multiply dark:mix-blend-normal"
          />
        ) : (
          <div className="w-full flex justify-center bg-transparent">
            <Image
              src={logoSrc}
              alt="El Chorolqui"
              width={80}
              height={40}
              className="h-8 w-auto object-contain bg-transparent mix-blend-multiply dark:mix-blend-normal"
            />
          </div>
        )}
      </div>
    </Link>
  )
}

export default SideBarLogo