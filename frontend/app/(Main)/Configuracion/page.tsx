import ConfigBtn from "@/components/Config/ConfigBtn";
import { Users } from "lucide-react";

export default function ConfiguracionPage() {
  return (
    <main className="p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ConfigBtn
          link="/Configuracion/Usuarios"
          title="Usuarios"
          icon={Users}
          color="bg-card text-black border border-border"
          disabled
          badge="Próximamente"
        />
      </div>
    </main>
  );
}


