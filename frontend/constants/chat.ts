export interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
}

export const EXAMPLE_MESSAGES: Message[] = [
    {
        id: "1",
        role: "assistant",
        content: "¡Hola! Soy tu asistente de POS. Puedo ayudarte con ventas, inventario, reportes y más. ¿Qué necesitás?",
        timestamp: new Date()
    },
    {
        id: "2",
        role: "user",
        content: "¿Cómo van las ventas hoy?",
        timestamp: new Date()
    },
    {
        id: "3",
        role: "assistant",
        content: "Las ventas de hoy van bien. Llevás $45.230 en total con 12 transacciones. El ticket promedio es de $3.769.\n\nEl producto más vendido es \"Milanesa napolitana\" con 8 unidades. ¿Querés ver el detalle por hora?",
        timestamp: new Date()
    },
    {
        id: "4",
        role: "user",
        content: "Mostrame los productos con stock bajo",
        timestamp: new Date()
    },
    {
        id: "5",
        role: "assistant",
        content: "Tenés 3 productos por debajo del mínimo:\n\n• **Milanesa napolitana** — 2 unidades (mín: 10)\n• **Papas fritas** — 5 unidades (mín: 15)\n• **Coca-Cola 500ml** — 8 unidades (mín: 20)\n\n¿Querés que genere una orden de reposición?",
        timestamp: new Date()
    }
]
