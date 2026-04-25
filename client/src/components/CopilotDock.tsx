import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "Wie hoch ist meine Liquidität?",
  "Welche Rechnungen sind überfällig?",
  "MWST-Abrechnung Q1 erklären",
  "Offene Buchungen prüfen",
];

/**
 * KLAX Copilot Dock — fixed bottom-right launcher mit echtem KI-Backend.
 * Keyboard shortcut: Ctrl/Cmd+J
 */
export default function CopilotDock() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = trpc.avatarChat.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply ?? "Ich konnte keine Antwort generieren.",
      }]);
    },
    onError: (err) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Fehler: ${err.message}`,
      }]);
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setQuery("");

    chatMutation.mutate({
      message: trimmed,
      conversationHistory: updatedMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
    });
  };

  const handleReset = () => {
    setMessages([]);
    setQuery("");
  };

  return (
    <div
      className="fixed z-40 no-print"
      style={{ right: 20, bottom: 20 }}
    >
      {open && (
        <div
          className="mb-3 flex flex-col"
          style={{
            width: 380,
            height: 480,
            background: "var(--surface)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-3)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid var(--hair)" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--ai) 0%, #6B5AA8 100%)",
                color: "#fff",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                Klax Copilot
              </div>
              <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>
                Buchhaltungs-Assistent · KI-gestützt
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleReset}
                className="p-1 rounded hover:bg-muted/50 transition-colors"
                style={{ color: "var(--ink-3)" }}
                title="Gespräch zurücksetzen"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
              style={{ color: "var(--ink-3)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-3"
            style={{ color: "var(--ink-2)" }}
          >
            {messages.length === 0 ? (
              <>
                <div
                  className="p-2.5 rounded-md text-[12.5px]"
                  style={{ background: "var(--ai-soft)", color: "var(--ai)" }}
                >
                  Hallo! Ich bin Klax, Ihr Buchhaltungs-Assistent. Ich habe Zugriff auf Ihre aktuellen Buchungen, Konten und Belege. Wie kann ich helfen?
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_PROMPTS.map(s => (
                    <button
                      key={s}
                      className="pill text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleSubmit(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-[12.5px] rounded-lg px-3 py-2 max-w-[90%]",
                    msg.role === "user"
                      ? "ml-auto"
                      : "mr-auto"
                  )}
                  style={
                    msg.role === "user"
                      ? { background: "var(--klax-accent)", color: "#fff" }
                      : { background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--hair)" }
                  }
                >
                  {msg.content}
                </div>
              ))
            )}
            {chatMutation.isPending && (
              <div
                className="flex items-center gap-2 text-[12px] mr-auto rounded-lg px-3 py-2"
                style={{ background: "var(--surface-2)", color: "var(--ink-3)", border: "1px solid var(--hair)" }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Klax denkt nach…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            className="flex items-center gap-2 px-3 py-2 shrink-0"
            style={{ borderTop: "1px solid var(--hair)" }}
            onSubmit={e => {
              e.preventDefault();
              handleSubmit(query);
            }}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Frag Klax …"
              className="flex-1 outline-none text-[13px] bg-transparent"
              style={{ color: "var(--ink)" }}
              disabled={chatMutation.isPending}
            />
            <button
              type="submit"
              disabled={!query.trim() || chatMutation.isPending}
              className="p-1.5 rounded-md transition-colors disabled:opacity-40"
              style={{
                background: query.trim() ? "var(--klax-accent)" : "var(--surface-2)",
                color: query.trim() ? "#fff" : "var(--ink-3)",
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full transition-all",
          "hover:-translate-y-0.5"
        )}
        style={{
          background: "var(--ink)",
          color: "#F4F1EA",
          boxShadow: "var(--shadow-2)",
        }}
      >
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, var(--ai) 0%, #6B5AA8 100%)",
            color: "#fff",
          }}
        >
          <Sparkles className="h-3 w-3" />
        </span>
        <span className="text-[12.5px] font-medium">Frag Klax …</span>
        <kbd
          className="text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{ background: "rgba(255,255,255,.08)", color: "#B8B1A3" }}
        >
          ⌘J
        </kbd>
      </button>
    </div>
  );
}
