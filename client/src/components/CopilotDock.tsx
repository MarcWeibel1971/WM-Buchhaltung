import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KLAX Copilot Dock — fixed bottom-right launcher.
 * Opens a lightweight chat panel; on submit it just hands off to the
 * existing AvatarChatWidget / KI endpoints in future iterations.
 */
export default function CopilotDock() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  return (
    <div
      className="fixed z-40 no-print"
      style={{ right: 20, bottom: 20 }}
    >
      {open && (
        <div
          className="mb-3 flex flex-col"
          style={{
            width: 340,
            height: 320,
            background: "var(--surface)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-3)",
            overflow: "hidden",
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5"
            style={{ borderBottom: "1px solid var(--hair)" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
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
                Fragen, Buchungshilfen, Suche
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded"
              style={{ color: "var(--ink-3)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 text-[12.5px] space-y-2"
            style={{ color: "var(--ink-2)" }}
          >
            <div
              className="p-2.5 rounded-md"
              style={{ background: "var(--ai-soft)", color: "var(--ai)" }}
            >
              Hallo! Ich bin Klax. Ich kann Belege zuordnen, Buchungen
              erklären und Konten finden. Frag einfach.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Wie hoch ist meine Liquidität?",
                "Offene Mahnungen",
                "MWST-Abrechnung Q1",
              ].map(s => (
                <button
                  key={s}
                  className="pill"
                  onClick={() => setQuery(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderTop: "1px solid var(--hair)" }}
            onSubmit={e => {
              e.preventDefault();
              if (!query.trim()) return;
              // Hand-off target: future KI endpoint / AvatarChatWidget
              setQuery("");
            }}
          >
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Frag Klax …"
              className="flex-1 outline-none text-[13px] bg-transparent"
              style={{ color: "var(--ink)" }}
            />
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ border: "1px solid var(--hair)", color: "var(--ink-3)" }}
            >
              ⌘J
            </kbd>
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
