"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CategoriasRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/Inventario?tab=categorias");
  }, [router]);

  return (
    <main className="p-4 flex flex-col gap-4 bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Redirigiendo a Inventario &gt; Categorías...</p>
      <Link href="/Inventario?tab=categorias" className="text-sm text-primary underline w-fit">
        Ir a Inventario &gt; Categorías
      </Link>
    </main>
  );
}
