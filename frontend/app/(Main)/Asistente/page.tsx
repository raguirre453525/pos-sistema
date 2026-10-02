"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, SendHorizonal, Sparkles, Trash2, X } from "lucide-react";
import ChatMessage from "@/components/Asistente/ChatMessage";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, askAssistant, confirmAssistantProposal, getAssistantProviders, getStoredToken, TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY_LEGACY, type ChatMessageDto, type ProposalResponse } from "@/lib/api";
import { loadAssistantImages, saveAssistantImages } from "@/lib/assistantChatStorage";

type UiMessage = { id: string; role: "user" | "assistant"; content: string; proposal?: ProposalResponse | null; images?: string[] };
type ImageAttachment = { name: string; dataUrl: string; size: number };

const STORAGE_KEY = "metratc:Asistente:messages";
const MAX_MESSAGES = 10;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const SESSION_CHANGED_MESSAGE = "La sesión no coincide con la cuenta del asistente. Vuelve a iniciar sesión para continuar.";

function getUserStorageKey(userId: string | null | undefined, businessId: string | null | undefined): string | null {
  if (!userId?.trim() || !businessId?.trim()) return null;
  return `${STORAGE_KEY}:${businessId.trim().toLowerCase()}:${userId.trim().toLowerCase()}`;
}

function getStorageKeyFromToken(token: string | null): string | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const encoded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as Record<string, unknown>;
    const userId = claims.sub ?? claims.nameid ?? claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    const businessId = claims.businessId ?? claims.BusinessId ?? claims.business_id;
    return typeof userId === "string" && typeof businessId === "string" ? getUserStorageKey(userId, businessId) : null;
  } catch {
    return null;
  }
}

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("No fue posible leer la imagen."));
    reader.onerror = () => reject(new Error("No fue posible leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function createMessageId(offset = 0): string {
  return (Date.now() + offset).toString();
}

function loadStoredMessages(storageKey: string | null): UiMessage[] {
  if (!storageKey) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UiMessage[];
    if (!Array.isArray(parsed)) return [];
    // cap to MAX_MESSAGES and validate shape
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(({ id, role, content, proposal }) => ({ id, role, content, proposal }))
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export default function AsistentePage() {
  const { user, businessId, token } = useAuth();
  const storageKey = getUserStorageKey(user?.id, businessId);

  if (!storageKey || !token || getStorageKeyFromToken(token) !== storageKey) {
    return (
      <main className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 bg-background p-3 text-foreground sm:p-4">
        <h1 className="text-2xl font-semibold tracking-tight">Asistente</h1>
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{SESSION_CHANGED_MESSAGE}</div>
      </main>
    );
  }

  return <AssistantChat key={storageKey} storageKey={storageKey} authToken={token} />;
}

function AssistantChat({ storageKey, authToken }: { storageKey: string; authToken: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [imageStorageReady, setImageStorageReady] = useState(false);
  const [pendingImageUploads, setPendingImageUploads] = useState(0);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageStorageWarning, setImageStorageWarning] = useState(false);
  const [provider, setProvider] = useState<string>("mock");
  const [available, setAvailable] = useState<string[]>(["mock", "openai", "deepseek"]);
  const [correctHint, setCorrectHint] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ImageAttachment[]>([]);
  const pendingImageUploadsRef = useRef(0);
  const imageUploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const imageUploadGenerationRef = useRef(0);

  // Load persisted chat only after the context and shared bearer token agree on its owner.
  useEffect(() => {
    if (getStorageKeyFromToken(getStoredToken()) !== storageKey) {
      window.location.reload();
      return;
    }

    let cancelled = false;
    const storedMessages = loadStoredMessages(storageKey);
    void loadAssistantImages(storageKey)
      .then((storedImages) => {
        if (cancelled) return;
        setMessages(storedMessages.map((message) => {
          const images = storedImages[message.id];
          return images?.length ? { ...message, images } : message;
        }));
        setImageStorageReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMessages(storedMessages);
          setImageStorageWarning(true);
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (getStorageKeyFromToken(getStoredToken()) !== storageKey) {
      window.location.reload();
      return;
    }
    getAssistantProviders(authToken)
      .then((p) => {
        setProvider(p.current);
        setAvailable(p.available);
      })
      .catch(() => {});
  }, [authToken, storageKey]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== TOKEN_STORAGE_KEY && event.key !== TOKEN_STORAGE_KEY_LEGACY) return;
      if (getStorageKeyFromToken(getStoredToken()) !== storageKey) window.location.reload();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey]);

  // Persist on change (cap 10, no basura acumulada)
  useEffect(() => {
    if (!hydrated) return;
    const persisted = messages.slice(-MAX_MESSAGES);
    try {
      if (persisted.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(persisted.map(({ id, role, content, proposal }) => ({ id, role, content, proposal }))));
      }
    } catch {}
    if (imageStorageReady) {
      void saveAssistantImages(storageKey, persisted)
        .then(() => setImageStorageWarning(false))
        .catch(() => setImageStorageWarning(true));
    }
  }, [messages, hydrated, imageStorageReady, storageKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function replaceAttachments(next: ImageAttachment[]) {
    attachmentsRef.current = next;
    setAttachments(next);
  }

  function clearChat() {
    imageUploadGenerationRef.current++;
    setMessages([]);
    replaceAttachments([]);
    setInput("");
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    void saveAssistantImages(storageKey, [])
      .then(() => setImageStorageWarning(false))
      .catch(() => setImageStorageWarning(true));
    setError(null);
    setCorrectHint(false);
    setShowClearConfirm(false);
  }

  function addImages(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;
    if (pendingImageUploadsRef.current === 0) setError(null);

    const generation = imageUploadGenerationRef.current;
    pendingImageUploadsRef.current++;
    setPendingImageUploads(pendingImageUploadsRef.current);

    const task = imageUploadQueueRef.current.then(async () => {
      if (generation !== imageUploadGenerationRef.current) return;

      const current = attachmentsRef.current;
      let totalBytes = current.reduce((total, image) => total + image.size, 0);
      let addedCount = 0;
      const accepted: ImageAttachment[] = [];
      const rejected: string[] = [];

      for (const file of selectedFiles) {
        if (generation !== imageUploadGenerationRef.current) return;
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
          rejected.push(`${file.name}: formato no compatible. Selecciona imágenes JPEG, PNG, GIF o WebP.`);
          continue;
        }
        if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
          rejected.push(`${file.name}: cada imagen debe pesar como máximo 5 MB.`);
          continue;
        }
        if (current.length + addedCount >= MAX_IMAGES) {
          rejected.push(`Puedes adjuntar hasta ${MAX_IMAGES} imágenes.`);
          continue;
        }
        if (totalBytes + file.size > MAX_TOTAL_IMAGE_BYTES) {
          rejected.push("El total de imágenes no puede superar 10 MB.");
          continue;
        }

        try {
          const dataUrl = await readImageDataUrl(file);
          if (generation !== imageUploadGenerationRef.current) return;
          accepted.push({ name: file.name, dataUrl, size: file.size });
          addedCount++;
          totalBytes += file.size;
        } catch {
          rejected.push(`${file.name}: no fue posible leer la imagen.`);
        }
      }

      if (generation !== imageUploadGenerationRef.current) return;
      if (accepted.length > 0) replaceAttachments([...attachmentsRef.current, ...accepted]);
      if (rejected.length > 0) setError((currentError) => currentError ? `${currentError} ${rejected.join(" ")}` : rejected.join(" "));
    });

    imageUploadQueueRef.current = task.catch(() => {});
    void task
      .catch(() => {
        if (generation === imageUploadGenerationRef.current) {
          setError((currentError) => currentError ? `${currentError} No fue posible procesar una imagen.` : "No fue posible procesar una imagen.");
        }
      })
      .finally(() => {
        pendingImageUploadsRef.current--;
        setPendingImageUploads(pendingImageUploadsRef.current);
      });
  }

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) void addImages(event.currentTarget.files);
    event.currentTarget.value = "";
  }

  function hasCurrentSession() {
    const authKey = getStorageKeyFromToken(authToken);
    const storedKey = getStorageKeyFromToken(getStoredToken());
    if (authKey === storageKey && storedKey === storageKey) return true;
    if (authKey === storageKey && storedKey !== storageKey) window.location.reload();
    return false;
  }

  async function send() {
    const message = input;
    const currentAttachments = attachmentsRef.current;
    if (!hydrated || pendingImageUploadsRef.current > 0 || (!message.trim() && currentAttachments.length === 0) || loading) return;
    if (!hasCurrentSession()) return;
    if (message.length > 2000) {
      setError("El mensaje no puede exceder 2000 caracteres.");
      return;
    }
    const images = currentAttachments.map((attachment) => attachment.dataUrl);
    setError(null);
    setCorrectHint(false);
    const userMsg: UiMessage = { id: createMessageId(), role: "user", content: message, ...(images.length ? { images } : {}) };
    // cap to MAX_MESSAGES when adding
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    setInput("");
    replaceAttachments([]);
    setLoading(true);
    try {
      // history = last MAX_MESSAGES without the current userMsg (backend also caps to 20, we send 10)
      const prevSlice = messages.slice(-MAX_MESSAGES);
      const history: ChatMessageDto[] = prevSlice.filter((m) => m.content.trim().length > 0).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      // backend gets history (last 10) + current message separately
      const historyCapped = history.slice(-(MAX_MESSAGES - 1));
      const res = await askAssistant(message, historyCapped, images, authToken);
      setProvider(res.provider);
      const assistantMsg: UiMessage = { id: createMessageId(1), role: "assistant", content: res.reply, proposal: res.proposal ?? null };
      setMessages((prev) => [...prev, assistantMsg].slice(-MAX_MESSAGES));
    } catch (e) {
      const err = e as ApiError;
      const msg = err?.message || "Error al contactar al Asistente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (loading) return;
    if (!hasCurrentSession()) return;
    // find last proposal message to check hasMissingData guard
    const last = messages[messages.length - 1];
    if (last?.proposal?.hasMissingData) return;
    setError(null);
    setCorrectHint(false);
    const userMsg: UiMessage = { id: createMessageId(), role: "user", content: "confirmar" };
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    setLoading(true);
    try {
      const prevSlice = messages.slice(-MAX_MESSAGES);
      const history: ChatMessageDto[] = prevSlice.filter((m) => m.content.trim().length > 0).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const historyCapped = history.slice(-(MAX_MESSAGES - 1));
      const res = await confirmAssistantProposal(historyCapped, authToken);
      setProvider(res.provider);
      const assistantMsg: UiMessage = { id: createMessageId(1), role: "assistant", content: res.reply, proposal: res.proposal ?? null };
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
      (document.querySelector('input[aria-label="Pregunta al Asistente"]') as HTMLInputElement | null)?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <main
      onDragEnter={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setIsDragging(false);
        void addImages(event.dataTransfer.files);
      }}
      className={`relative flex h-full min-h-0 w-full min-w-0 max-w-none flex-col gap-3 overflow-hidden bg-background p-3 text-foreground sm:gap-4 sm:p-4 lg:gap-6 ${isDragging ? "ring-2 ring-inset ring-red-500" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Asistente</h1>
        <div className="flex items-center gap-2 ml-auto">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted lg:min-h-9"
              title="Borrar historial"
            >
              <Trash2 size={12} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="min-w-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 [overflow-wrap:anywhere]" role="alert">
          {error}
          {error.toLowerCase().includes("api_key") && (
            <span className="block mt-1 text-xs">
              Configura <code>DEEPSEEK_API_KEY</code> en el entorno del backend; no la guardes en el frontend.
            </span>
          )}
        </div>
      )}

      <div ref={listRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {hydrated && messages.length === 0 && !loading && (
          <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Aún no hay mensajes. Preguntá algo sobre tu inventario — por ejemplo, “¿qué productos tienen stock bajo?”.
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={msg.id}>
            <ChatMessage role={msg.role} content={msg.content} images={msg.images} />
            {msg.proposal && msg.proposal.proposals.length > 0 && (
              <div role="region" aria-label="Propuesta de productos" tabIndex={0} className="mx-2 mb-2 min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[640px] text-xs">
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
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${p.exists ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
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
                  <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-3 py-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={loading || !!msg.proposal.hasMissingData}
                      title={msg.proposal.hasMissingData ? "Faltan datos obligatorios" : "Confirmar propuesta"}
                      className="min-h-11 rounded-md bg-red-500 px-4 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-8"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={handleCorrect}
                      disabled={loading}
                      className="min-h-11 rounded-md border border-border bg-card px-4 py-1 text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-8"
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
            <div className="bg-muted text-foreground rounded-xl rounded-bl-sm px-4 py-2 max-w-[75%]">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-md animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-md animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-md animate-bounce" />
              </span>
            </div>
          </div>
        )}
      </div>

      {correctHint && (
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-2">
          Decí qué corregir (ej: &apos;el sku es XXX&apos; o &apos;el precio es 1500&apos;)
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Imágenes adjuntas">
          {attachments.map((attachment, index) => (
            <div key={`${attachment.name}-${index}`} className="relative flex shrink-0 flex-col items-center gap-1">
              <Image src={attachment.dataUrl} alt={`Vista previa de ${attachment.name}`} width={80} height={64} unoptimized className="h-16 w-20 rounded-md border border-border object-cover" />
              <button
                type="button"
                aria-label={`Quitar ${attachment.name}`}
                onClick={() => replaceAttachments(attachmentsRef.current.filter((_, imageIndex) => imageIndex !== index))}
                className="absolute -right-2 -top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-background text-foreground shadow"
              >
                <X size={16} />
              </button>
              <span className="max-w-20 truncate text-[10px] text-muted-foreground" title={attachment.name}>{attachment.name}</span>
            </div>
          ))}
        </div>
      )}
      {pendingImageUploads > 0 && (
        <div id="assistant-image-upload-status" className="text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
          Procesando imágenes adjuntas. Esperá antes de enviar.
        </div>
      )}
      {imageStorageWarning && (
        <div className="min-w-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 [overflow-wrap:anywhere]" role="status">
          No se pudieron guardar o cargar las imágenes adjuntas.
        </div>
      )}

      <div className="mt-auto flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <input ref={fileInputRef} type="file" accept={SUPPORTED_IMAGE_TYPES.join(",")} multiple disabled={loading} className="sr-only" aria-label="Seleccionar imágenes" onChange={handleFileSelection} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" disabled={loading} className="sr-only" aria-label="Tomar una foto" onChange={handleFileSelection} />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <ImagePlus size={18} />
            Imagen
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Camera size={18} />
            Cámara
          </button>
        </div>
        <div className="flex min-w-0 flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Sparkles size={18} className="text-muted-foreground" />
            </div>
            <input
              ref={inputRef}
              type="text"
              aria-label="Pregunta al Asistente"
              placeholder="Pregunta al Asistente..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (correctHint) setCorrectHint(false);
              }}
              onKeyDown={onKeyDown}
              disabled={loading}
              className="block min-h-11 w-full rounded-md border border-border bg-muted py-2 pl-10 pr-3 text-base placeholder-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 lg:min-h-10 lg:text-sm"
            />
          </div>

          <button
            type="button"
            aria-label="Enviar"
            aria-describedby={pendingImageUploads > 0 ? "assistant-image-upload-status" : undefined}
            onClick={send}
            disabled={!hydrated || loading || pendingImageUploads > 0 || (!input.trim() && attachments.length === 0)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-500 transition-colors duration-300 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 lg:w-10"
          >
            <SendHorizonal size={18} className="text-background" />
          </button>
        </div>
      </div>

      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background/80 text-lg font-medium text-foreground" role="status">
          Suelta las imágenes aquí
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowClearConfirm(false)}>
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="clear-confirm-title">
            <h3 id="clear-confirm-title" className="text-sm font-semibold text-foreground">¿Deseas borrar el chat?</h3>
            <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="min-h-11 rounded-md border border-border bg-card px-4 py-1.5 text-xs font-medium transition-colors hover:bg-muted lg:min-h-9"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={clearChat}
                className="min-h-11 rounded-md bg-red-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 lg:min-h-9"
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




