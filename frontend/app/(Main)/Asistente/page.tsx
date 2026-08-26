"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal, Sparkles } from "lucide-react";
import ChatMessage from "@/components/Asistente/ChatMessage";
import { ApiError, askAssistant, getAssistantProviders, type ChatMessageDto } from "@/lib/api";
import { EXAMPLE_MESSAGES } from "@/constants/chat";

type UiMessage = { id: string; role: "user" | "assistant"; content: string };

export default function AsistentePage() {
  const [messages, setMessages] = useState<UiMessage[]>(() =>
    EXAMPLE_MESSAGES.map((m) => ({ id: m.id, role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("mock");
  const [available, setAvailable] = useState<string[]>(["mock", "openai", "gemini"]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAssistantProviders()
      .then((p) => {
        setProvider(p.current);
        setAvailable(p.available);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (text.length > 2000) {
      setError("El mensaje no puede exceder 2000 caracteres.");
      return;
    }
    setError(null);
    const userMsg: UiMessage = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const history: ChatMessageDto[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      // Send only last 20 + current handled by backend, but we send history without last user (backend adds message)
      const historyWithoutLast = history.slice(0, -1).slice(-20);
      const res = await askAssistant(text, historyWithoutLast);
      setProvider(res.provider);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: res.reply },
      ]);
    } catch (e) {
      const err = e as ApiError;
      const msg = err?.message || "Error al contactar al asistente.";
      setError(msg);
      // Fallback: keep mock hint if API fails and we were on mock-like content
      if (err?.status === 400 && msg.toLowerCase().includes("apikey")) {
        // keep error banner visible
      }
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <main className="h-full p-4 flex flex-col gap-6 bg-background text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-foreground text-2xl">ASISTENTE</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Provider:</span>
          <span className="inline-flex items-center rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-medium">
            {provider}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            disponibles: {available.join(", ")}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm" role="alert">
          {error}
          {error.toLowerCase().includes("apikey") && (
            <span className="block mt-1 text-xs">
              Configurá <code>Assistant:OpenAI:ApiKey</code> en <code>backend/appsettings.Development.json</code> o
              variable <code>Assistant__OpenAI__ApiKey</code> y poné <code>Assistant:Provider=openai</code>.
            </span>
          )}
        </div>
      )}

      <div ref={listRef} className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-2 p-2">
            <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-2 max-w-[75%]">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-row">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Sparkles size={18} className="text-muted-foreground" />
          </div>
          <input
            type="text"
            aria-label="Pregunta al asistente"
            placeholder="Pregunta al asistente..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-full bg-muted text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          aria-label="Enviar"
          onClick={send}
          disabled={loading || !input.trim()}
          className="flex rounded-full bg-red-500 items-center justify-center w-10 h-10 ml-2 hover:bg-red-800 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <SendHorizonal size={18} className="text-background" />
        </button>
      </div>
    </main>
  );
}
