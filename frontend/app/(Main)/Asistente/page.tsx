"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal, Sparkles, Trash2 } from "lucide-react";
import ChatMessage from "@/components/Asistente/ChatMessage";
import { ApiError, askAssistant, confirmAssistantProposal, getAssistantProviders, type ChatMessageDto, type ProposalResponse } from "@/lib/api";

type UiMessage = { id: string; role: "user" | "assistant"; content: string; proposal?: ProposalResponse | null };

const STORAGE_KEY = "metratc:asistente:messages";
const MAX_MESSAGES = 10;

function loadStoredMessages(): UiMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UiMessage[];
    if (!Array.isArray(parsed)) return [];
    // cap to MAX_MESSAGES and validate shape
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export default function AsistentePage() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("mock");
  const [available, setAvailable] = useState<string[]>(["mock", "openai", "deepseek"]);
  const [correctHint, setCorrectHint] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load persisted chat on mount (no default messages)
  useEffect(() => {
    setMessages(loadStoredMessages());
    setHydrated(true);
    getAssistantProviders()
      .then((p) => {
        setProvider(p.current);
        setAvailable(p.available);
      })
      .catch(() => {});
  }, []);

  // Persist on change (cap 10, no basura acumulada)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {}
  }, [messages, hydrated]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function clearChat() {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setError(null);
    setCorrectHint(false);
    setShowClearConfirm(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (text.length > 2000) {
      setError("El mensaje no puede exceder 2000 caracteres.");
      return;
    }
    setError(null);
    setCorrectHint(false);
    const userMsg: UiMessage = { id: Date.now().toString(), role: "user", content: text };
    // cap to MAX_MESSAGES when adding
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    setInput("");
    setLoading(true);
    try {
      // history = last MAX_MESSAGES without the current userMsg (backend also caps to 20, we send 10)
      const prevSlice = messages.slice(-MAX_MESSAGES);
      const history: ChatMessageDto[] = prevSlice.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      // backend gets history (last 10) + current message separately
      const historyCapped = history.slice(-(MAX_MESSAGES - 1));
      const res = await askAssistant(text, historyCapped);
      setProvider(res.provider);
      const assistantMsg: UiMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: res.reply, proposal: res.proposal ?? null };
      setMessages((prev) => [...prev, assistantMsg].slice(-MAX_MESSAGES));
    } catch (e) {
      const err = e as ApiError;
      const msg = err?.message || "Error al contactar al asistente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (loading) return;
    // find last proposal message to check hasMissingData guard
    const last = messages[messages.length - 1];
    if (last?.proposal?.hasMissingData) return;
    setError(null);
    setCorrectHint(false);
    const userMsg: UiMessage = { id: Date.now().toString(), role: "user", content: "confirmar" };
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    setLoading(true);
    try {
      const prevSlice = messages.slice(-MAX_MESSAGES);
      const history: ChatMessageDto[] = prevSlice.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const historyCapped = history.slice(-(MAX_MESSAGES - 1));
      const res = await confirmAssistantProposal(historyCapped);
      setProvider(res.provider);
      const assistantMsg: UiMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: res.reply, proposal: res.proposal ?? null };
      setMessages((prev) => [...prev, assistantMsg].slice(-MAX_MESSAGES));
    } catch (e) {
      const err = e as ApiError;
      const msg = err?.message || "Error al confirmar.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleCorrect() {
    setError(null);
    setCorrectHint(true);
    setInput("");
    // focus with ref, fallback to querySelector per spec
    if (inputRef.current) {
      inputRef.current.focus();
    } else {
      (document.querySelector('input[aria-label="Pregunta al asistente"]') as HTMLInputElement | null)?.focus();
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
        <div className="flex items-center gap-2 ml-auto">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted transition-colors"
              title="Borrar historial"
            >
              <Trash2 size={12} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm" role="alert">
          {error}
          {error.toLowerCase().includes("apikey") && (
            <span className="block mt-1 text-xs">
              Configurá <code>Assistant:DeepSeek:ApiKey</code> en <code>backend/appsettings.Development.json</code> o variable{" "}
              <code>Assistant__DeepSeek__ApiKey</code> y poné <code>Assistant:Provider=deepseek</code>.
            </span>
          )}
        </div>
      )}

      <div ref={listRef} className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {hydrated && messages.length === 0 && !loading && (
          <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Aún no hay mensajes. Preguntá algo sobre tu inventario — por ejemplo, “¿qué productos tienen stock bajo?”.
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={msg.id}>
            <ChatMessage role={msg.role} content={msg.content} />
            {msg.proposal && msg.proposal.proposals.length > 0 && (
              <div className="mx-2 mb-2 overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Producto</th>
                      <th className="px-2 py-1">SKU</th>
                      <th className="px-2 py-1">Existe?</th>
                      <th className="px-2 py-1">Acción</th>
                      <th className="px-2 py-1">Stock</th>
                      <th className="px-2 py-1">Precio</th>
                      <th className="px-2 py-1">Categoría</th>
                      <th className="px-2 py-1">Faltantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msg.proposal.proposals.map((p, j) => {
                      const skuMissing = p.missingFields.includes("Sku");
                      return (
                      <tr key={j} className="border-t border-border">
                        <td className="px-2 py-1 font-medium">{p.name || "-"}</td>
                        <td className={`px-2 py-1 text-center font-mono uppercase text-[11px] ${skuMissing ? "text-red-400" : ""}`}>{p.sku ? p.sku.toUpperCase() : "—"}</td>
                        <td className="px-2 py-1 text-center">{p.exists ? "Sí" : "No"}</td>
                        <td className="px-2 py-1 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.exists ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {p.action}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center">{p.stockDelta != null ? `+${p.stockDelta} (actual: ${p.currentStock ?? "-"})` : p.currentStock != null ? `actual: ${p.currentStock}` : "-"}</td>
                        <td className="px-2 py-1 text-center">{p.price != null ? (p.exists ? `${p.currentPrice} → ${p.price}` : `${p.price}`) : (p.currentPrice ?? "-")}</td>
                        <td className="px-2 py-1 text-center">{p.categoryNames?.join(", ") ?? "-"}</td>
                        <td className="px-2 py-1 text-center">{p.missingFields.length ? <span className="text-red-600 font-medium">{p.missingFields.join(", ")}</span> : "-"}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                  {msg.proposal.hasMissingData ? "⚠️ Faltan datos obligatorios. Respondé con los campos faltantes." : "¿Te parece bien? Decí \"sí, dale\" para confirmar o decime qué corregir."}
                </div>
                {idx === messages.length - 1 && (
                  <div className="flex gap-2 px-3 py-2 border-t border-border bg-muted/20">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={loading || !!msg.proposal.hasMissingData}
                      title={msg.proposal.hasMissingData ? "Faltan datos obligatorios" : "Confirmar propuesta"}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-full px-4 py-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={handleCorrect}
                      disabled={loading}
                      className="border border-border bg-card hover:bg-muted rounded-full px-4 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Corregir
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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

      {correctHint && (
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
          Decí qué corregir (ej: &apos;el sku es XXX&apos; o &apos;el precio es 1500&apos;)
        </div>
      )}

      <div className="mt-auto flex flex-row">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Sparkles size={18} className="text-muted-foreground" />
          </div>
          <input
            ref={inputRef}
            type="text"
            aria-label="Pregunta al asistente"
            placeholder="Pregunta al asistente..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (correctHint) setCorrectHint(false);
            }}
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

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="clear-confirm-title">
            <h3 id="clear-confirm-title" className="text-sm font-semibold text-foreground">¿Deseas borrar el chat?</h3>
            <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-full border border-border bg-card hover:bg-muted px-4 py-1.5 text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={clearChat}
                className="rounded-full bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 text-xs font-medium transition-colors"
              >
                Confirmar borrado
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
