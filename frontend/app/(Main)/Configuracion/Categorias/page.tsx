"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFeatureGuard } from "@/hooks/useFeatureGuard";

export default function CategoriasRedirectPage() {
  const router = useRouter();
  const { allowed } = useFeatureGuard({ denyRoles: ["User"] });
  useEffect(() => {
    if (!allowed) {
      router.replace("/Ventas");
      return;
    }
    router.replace("/Inventario?tab=categorias");
  }, [router, allowed]);

  return (
    <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-4 bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Redirigiendo a Inventario &gt; Categorías...</p>
      <Link href="/Inventario?tab=categorias" className="text-sm text-primary underline w-fit">
        Ir a Inventario &gt; Categorías
      </Link>
    </main>
  );
}
