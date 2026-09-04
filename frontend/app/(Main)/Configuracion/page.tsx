import ConfigBtn from "@/components/Config/ConfigBtn";
import { Users } from "lucide-react";

export default function ConfiguracionPage() {
  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-semibold">CONFIGURACIÓN</h1>
        <p className="text-sm text-muted-foreground">Ajustes técnicos y de negocio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ConfigBtn
          link="/Configuracion/Usuarios"
          title="Usuarios"
          icon={Users}
          color="bg-white text-black border border-gray-200"
          disabled
          badge="Próximamente"
        />
      </div>
    </main>
  );
}
