"use client";

import Navbar from "@/components/layout/NavBar";
import SideBar from "@/components/layout/SideBar";
import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isVentas = pathname === "/Ventas" || pathname?.startsWith("/Ventas");
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SideBar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className={`flex-1 bg-background/50 min-h-0 ${isVentas ? "overflow-hidden p-3 pt-3 flex flex-col" : "overflow-y-auto p-6 py-0"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
