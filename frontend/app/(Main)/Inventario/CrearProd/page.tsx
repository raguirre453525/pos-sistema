import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react";
import { NewProductForm } from "@/components/Inventario/Forms/NewProductForm"
import { ImageForm } from "@/components/Inventario/Forms/ImageForm"

const page = () => {
  return (
    <main className="w-full min-w-full max-w-none p-4 flex flex-col gap-6 bg-background text-foreground">
        <Link href={"/Inventario"}><Button variant="outline" size="icon" className="rounded-md">
        <ArrowLeft />
      </Button></Link>
      <h1 className="text-foreground text-2xl">Crear producto</h1>
      
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card h-96 rounded-xl border border-border shadow-sm p-6">
            <NewProductForm />
          </div>
          <div className="lg:col-span-1 bg-card h-96 rounded-xl border border-border shadow-sm p-6">
            <ImageForm />
          </div>
      </div>
    
    </main>
  )
}

export default page


