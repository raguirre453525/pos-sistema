import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NewProductForm } from "@/components/Inventario/Forms/NewProductForm";

export default function CreateProductPage() {
  return (
    <main className="flex w-full min-w-0 max-w-none flex-col gap-4 bg-background p-3 text-foreground sm:gap-6 sm:p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-md sm:h-9 sm:w-9">
          <Link href="/Inventario" aria-label="Volver a Inventario">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Crear producto</h1>
      </div>

      <div className="w-full max-w-5xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <NewProductForm />
      </div>
    </main>
  );
}
