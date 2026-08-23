import { SendHorizonal, Sparkles } from "lucide-react"
import ChatMessage from "@/components/Asistente/ChatMessage"
import { EXAMPLE_MESSAGES } from "@/constants/chat"

const page = () => {
  return (
    <main className="h-full p-4 flex flex-col gap-6 bg-background text-foreground">
      <h1 className="text-foreground text-2xl">ASISTENTE</h1>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {EXAMPLE_MESSAGES.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
      </div>

      <div className="mt-auto flex flex-row">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Sparkles size={18} className="text-muted-foreground" />
          </div>
          <input
            type="text"
            aria-label='Pregunta al asistente'
            placeholder="Pregunta al asistente..."
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-full bg-muted text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />

        </div>

        <div className="flex rounded-full bg-red-500 items-center justify-center w-10 h-10 ml-2 hover:bg-red-800 transition-colors duration-300 cursor-pointer">

            <SendHorizonal size={18} className="text-background" />

        </div>

      </div>
    </main>
  )
}

export default page
