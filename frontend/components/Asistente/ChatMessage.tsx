
interface ChatMessageProps {
    role: "user" | "assistant"
    content: string
}

const ChatMessage = ({ role, content }: ChatMessageProps) => {
    const isUser = role === "user"
    const bubbleClass = isUser ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm ml-auto"
  : "bg-muted text-foreground rounded-2xl rounded-bl-sm"
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2 p-2`}>
        <div className={`flex items-center ${bubbleClass} px-4 py-2 max-w-[75%]`}>
            <p className="text-sm whitespace-pre-wrap break-words">{displayContent}</p>
        </div>
    </div>
  )
}

export default ChatMessage