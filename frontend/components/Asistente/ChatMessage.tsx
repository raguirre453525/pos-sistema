
interface ChatMessageProps {
    role: "user" | "assistant"
    content: string
}

const ChatMessage = ({ role, content }: ChatMessageProps) => {
    const isUser = role === "user"
    const bubbleClass = isUser ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm ml-auto"
  : "bg-muted text-foreground rounded-2xl rounded-bl-sm"
    return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2 p-2`}>
        <div className={`flex items-center ${bubbleClass} px-4 py-2 max-w-[75%]`}>
            <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        </div>
    </div>
  )
}

export default ChatMessage