
import Image from "next/image"

interface ChatMessageProps {
    role: "user" | "assistant"
    content: string
    images?: string[]
}

const ChatMessage = ({ role, content, images }: ChatMessageProps) => {
    const isUser = role === "user"
    const bubbleClass = isUser ? "bg-primary text-primary-foreground rounded-xl rounded-br-sm ml-auto"
  : "bg-muted text-foreground rounded-xl rounded-bl-sm"
    // Defensive: strip legacy markdown table (| ... |) that was previously rendered in bubble
    // The structured table is already rendered separately, so we hide pipes to avoid duplicate
    const displayContent = (() => {
        if (isUser) return content
        // If content contains markdown table (pipe lines), remove those lines
        if (content.includes("|") && content.includes("---")) {
            const filtered = content
                .split("\n")
                .filter((l) => !l.trim().startsWith("|"))
                .join("\n")
                .trim()
            return filtered || content
        }
        // Also strip any isolated pipe table rows (heuristic)
        if (content.includes("| Producto |")) {
            return content
                .split("\n")
                .filter((l) => !l.includes("|"))
                .join("\n")
                .trim()
        }
        return content
    })()
    return (
    <div className={`mb-2 flex w-full min-w-0 ${isUser ? "justify-end" : "justify-start"} p-2`}>
        <div className={`flex min-w-0 max-w-[90%] flex-col gap-2 ${bubbleClass} px-3 py-2 sm:max-w-[75%] sm:px-4`}>
            {displayContent && <p className="min-w-0 break-words whitespace-pre-wrap text-sm">{displayContent}</p>}
            {images?.length ? (
                <div className="flex max-w-full flex-wrap gap-2">
                    {images.map((src, index) => (
                        <Image key={index} src={src} alt={`Imagen adjunta ${index + 1}`} width={240} height={180} unoptimized className="h-auto max-h-40 max-w-full rounded-md object-contain" />
                    ))}
                </div>
            ) : null}
        </div>
    </div>
  )
}

export default ChatMessage
