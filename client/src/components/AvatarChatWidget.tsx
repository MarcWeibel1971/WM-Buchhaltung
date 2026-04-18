/**
 * AvatarChatWidget – schwebendes Berater-Chat-Widget
 *
 * Features:
 * - Professioneller CSS-Avatar (kein WebGL/Three.js → kein Absturz)
 * - ElevenLabs TTS mit Lip-Sync via AudioContext
 * - VAD-Mikrofon: automatisches Senden nach 1.5s Stille
 * - Texteingabe als Fallback
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Mic, MicOff, Volume2, VolumeX, X, Send, MessageCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── CSS Avatar Component ───────────────────────────────────────────────────────

function AdvisorAvatar({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">
      {/* Background gradient */}
      <div className="absolute inset-0 rounded-t-xl" style={{ background: "linear-gradient(160deg, #1a2744 0%, #0f172a 100%)" }} />

      {/* Avatar body */}
      <div className="relative flex flex-col items-center" style={{ marginTop: "-8px" }}>
        {/* Head */}
        <div className="relative" style={{ width: 90, height: 100 }}>
          {/* Neck */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-b-sm" style={{ width: 28, height: 22, background: "#d4a574" }} />
          {/* Head shape */}
          <div className="absolute inset-x-0 top-0 rounded-2xl" style={{ height: 88, background: "#d4a574", borderRadius: "50% 50% 45% 45% / 55% 55% 45% 45%" }}>
            {/* Hair – grey */}
            <div className="absolute inset-x-0 top-0 rounded-t-2xl overflow-hidden" style={{ height: 32, background: "#9ca3af", borderRadius: "50% 50% 0 0 / 60% 60% 0 0" }} />
            {/* Side hair */}
            <div className="absolute left-0 top-4" style={{ width: 10, height: 30, background: "#9ca3af", borderRadius: "4px 0 0 4px" }} />
            <div className="absolute right-0 top-4" style={{ width: 10, height: 30, background: "#9ca3af", borderRadius: "0 4px 4px 0" }} />

            {/* Eyebrows */}
            <div className="absolute" style={{ left: 14, top: 28, width: 18, height: 3, background: "#6b7280", borderRadius: 2, transform: "rotate(-3deg)" }} />
            <div className="absolute" style={{ right: 14, top: 28, width: 18, height: 3, background: "#6b7280", borderRadius: 2, transform: "rotate(3deg)" }} />

            {/* Eyes */}
            <div className="absolute flex items-center justify-center" style={{ left: 14, top: 34, width: 20, height: 14, background: "white", borderRadius: "50%", border: "1.5px solid #d1d5db" }}>
              <div style={{ width: 8, height: 8, background: "#1e3a5f", borderRadius: "50%" }} />
            </div>
            <div className="absolute flex items-center justify-center" style={{ right: 14, top: 34, width: 20, height: 14, background: "white", borderRadius: "50%", border: "1.5px solid #d1d5db" }}>
              <div style={{ width: 8, height: 8, background: "#1e3a5f", borderRadius: "50%" }} />
            </div>

            {/* Glasses */}
            <div className="absolute" style={{ left: 10, top: 32, width: 26, height: 18, border: "2px solid #374151", borderRadius: "40%", background: "rgba(147,197,253,0.15)" }} />
            <div className="absolute" style={{ right: 10, top: 32, width: 26, height: 18, border: "2px solid #374151", borderRadius: "40%", background: "rgba(147,197,253,0.15)" }} />
            <div className="absolute" style={{ left: 36, top: 38, width: 18, height: 2, background: "#374151" }} />
            {/* Glasses arms */}
            <div className="absolute" style={{ left: 2, top: 38, width: 8, height: 2, background: "#374151" }} />
            <div className="absolute" style={{ right: 2, top: 38, width: 8, height: 2, background: "#374151" }} />

            {/* Nose */}
            <div className="absolute" style={{ left: "50%", top: 52, width: 8, height: 10, transform: "translateX(-50%)", background: "#c49060", borderRadius: "0 0 50% 50%" }} />

            {/* Beard / Schnurrbart */}
            <div className="absolute" style={{ left: "50%", top: 62, width: 30, height: 6, transform: "translateX(-50%)", background: "#9ca3af", borderRadius: "50% 50% 0 0" }} />

            {/* Mouth – animated when speaking */}
            <div
              className="absolute overflow-hidden transition-all duration-75"
              style={{
                left: "50%",
                top: isSpeaking ? 70 : 72,
                width: isSpeaking ? 22 : 18,
                height: isSpeaking ? 10 : 5,
                transform: "translateX(-50%)",
                background: isSpeaking ? "#7f1d1d" : "#c49060",
                borderRadius: isSpeaking ? "0 0 50% 50%" : "50%",
                border: isSpeaking ? "1.5px solid #991b1b" : "none",
              }}
            >
              {isSpeaking && (
                <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 14, height: 5, background: "#ef4444", borderRadius: "50% 50% 0 0" }} />
              )}
            </div>

            {/* Ears */}
            <div className="absolute" style={{ left: -7, top: 40, width: 10, height: 14, background: "#d4a574", borderRadius: "50%" }} />
            <div className="absolute" style={{ right: -7, top: 40, width: 10, height: 14, background: "#d4a574", borderRadius: "50%" }} />
          </div>
        </div>

        {/* Shirt / Jacket */}
        <div className="relative" style={{ width: 110, height: 60, marginTop: -2 }}>
          {/* Jacket body */}
          <div className="absolute inset-0" style={{ background: "#1e3a5f", borderRadius: "0 0 12px 12px", clipPath: "polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)" }} />
          {/* White shirt */}
          <div className="absolute" style={{ left: "50%", top: 0, width: 22, height: 55, transform: "translateX(-50%)", background: "#f9fafb", borderRadius: "0 0 4px 4px" }} />
          {/* Tie */}
          <div className="absolute" style={{ left: "50%", top: 2, width: 10, height: 40, transform: "translateX(-50%)", background: "#dc2626", borderRadius: "2px 2px 50% 50%", clipPath: "polygon(20% 0%, 80% 0%, 100% 70%, 50% 100%, 0% 70%)" }} />
          {/* Lapels */}
          <div className="absolute" style={{ left: "22%", top: 0, width: 20, height: 35, background: "#1e3a5f", transform: "rotate(8deg)", transformOrigin: "top center" }} />
          <div className="absolute" style={{ right: "22%", top: 0, width: 20, height: 35, background: "#1e3a5f", transform: "rotate(-8deg)", transformOrigin: "top center" }} />
        </div>
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 items-end">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 3,
                background: "#60a5fa",
                animation: `soundbar 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                height: `${8 + Math.sin(i * 1.2) * 6}px`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes soundbar {
          from { transform: scaleY(0.4); opacity: 0.6; }
          to { transform: scaleY(1.4); opacity: 1; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────────────────

export default function AvatarChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [inputText, setInputText] = useState("");
  const [vadStatus, setVadStatus] = useState<"idle" | "listening" | "processing" | "sending">("idle");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Guten Tag! Ich bin Ihr digitaler Buchhaltungsberater. Wie kann ich Ihnen heute helfen?",
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationHistoryRef = useRef<{ role: string; content: string }[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // VAD refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadAnimFrameRef = useRef<number | null>(null);
  const hasSpeechRef = useRef(false);

  // tRPC
  const avatarChatMutation = trpc.avatarChat.chat.useMutation();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Audio playback ────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      // Stop all scheduled audio by suspending
      audioContextRef.current.suspend().catch(() => {});
    }
  }, []);

  const playAudio = useCallback(
    async (audioDataUrl: string) => {
      if (isMuted) return;
      stopSpeaking();

      try {
        // Create/resume AudioContext
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") await ctx.resume();

        // Decode base64 data URL
        const base64 = audioDataUrl.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        setIsSpeaking(true);
        source.onended = () => setIsSpeaking(false);
        source.start(0);
      } catch (err) {
        console.error("Audio playback error:", err);
        setIsSpeaking(false);
      }
    },
    [isMuted, stopSpeaking]
  );

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsLoading(true);

      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { role: "user", content: trimmed },
      ].slice(-10);

      try {
        const result = await avatarChatMutation.mutateAsync({
          message: trimmed,
          conversationHistory: conversationHistoryRef.current.slice(0, -1),
        });

        const replyText = typeof result.reply === "string" ? result.reply : String(result.reply);
        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: replyText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        conversationHistoryRef.current = [
          ...conversationHistoryRef.current,
          { role: "assistant", content: replyText },
        ];

        if (result.audioUrl) {
          await playAudio(result.audioUrl as string);
        }

        if (!isOpen) setHasNewMessage(true);
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: "Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, avatarChatMutation, playAudio, isOpen]
  );

  // ── VAD Microphone ────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (vadAnimFrameRef.current) cancelAnimationFrame(vadAnimFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach((t) => t.stop());
      vadStreamRef.current = null;
    }
    vadAnalyserRef.current = null;
    setIsListening(false);
    setVadStatus("idle");
    hasSpeechRef.current = false;
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      vadStreamRef.current = stream;

      // Set up AudioContext for VAD
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      vadAnalyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      // MediaRecorder for capturing audio
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (!hasSpeechRef.current || audioChunksRef.current.length === 0) {
          setVadStatus("idle");
          setIsListening(false);
          return;
        }

        setVadStatus("processing");
        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        try {
          // Send audio DIRECTLY to transcription endpoint (no S3 roundtrip)
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const transcribeRes = await fetch("/api/upload/transcribe", { method: "POST", body: formData });
          if (!transcribeRes.ok) {
            const errData = await transcribeRes.json().catch(() => ({ error: "Unbekannter Fehler" }));
            throw new Error(errData.error ?? "Transkription fehlgeschlagen");
          }
          const { text } = await transcribeRes.json() as { text: string };

          if (text?.trim()) {
            setVadStatus("sending");
            await sendMessage(text.trim());
          }
        } catch (err) {
          console.error("Transcription error:", err);
        } finally {
          setVadStatus("idle");
          setIsListening(false);
          hasSpeechRef.current = false;
        }
      };

      recorder.start(100); // collect data every 100ms
      setIsListening(true);
      setVadStatus("listening");
      hasSpeechRef.current = false;

      // VAD loop: detect speech and silence
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const SPEECH_THRESHOLD = 20; // RMS threshold for speech detection
      const SILENCE_DURATION = 1500; // ms of silence before sending

      const checkAudio = () => {
        if (!vadAnalyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms > SPEECH_THRESHOLD) {
          // Speech detected
          hasSpeechRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpeechRef.current && !silenceTimerRef.current) {
          // Silence after speech – start countdown
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            stopListening();
          }, SILENCE_DURATION);
        }

        vadAnimFrameRef.current = requestAnimationFrame(checkAudio);
      };

      vadAnimFrameRef.current = requestAnimationFrame(checkAudio);
    } catch (err) {
      console.error("Microphone error:", err);
      setIsListening(false);
      setVadStatus("idle");
    }
  }, [isListening, stopListening, sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // ── VAD status label ──────────────────────────────────────────────────────

  const vadLabel = {
    idle: "",
    listening: "Ich höre zu…",
    processing: "Verarbeite Sprache…",
    sending: "Sende Nachricht…",
  }[vadStatus];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setHasNewMessage(false); }}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
          style={{ width: 64, height: 64, background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)" }}
          title="Buchhaltungsberater öffnen"
        >
          <MessageCircle className="text-white" size={28} />
          {hasNewMessage && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: 360, height: 580, background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1e3a5f", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
              <span className="text-white text-sm font-semibold">WM Buchhaltungsberater</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title={isMuted ? "Ton einschalten" : "Ton ausschalten"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Chat schliessen"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Avatar area */}
          <div className="relative flex-shrink-0" style={{ height: 180 }}>
            <AdvisorAvatar isSpeaking={isSpeaking} />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ background: "#0f172a" }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? { background: "#2563eb", color: "white", borderBottomRightRadius: 4 }
                      : { background: "#1e293b", color: "#e2e8f0", borderBottomLeftRadius: 4 }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl" style={{ background: "#1e293b", borderBottomLeftRadius: 4 }}>
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          background: "#60a5fa",
                          animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VAD status */}
            {vadLabel && (
              <div className="flex justify-center">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "#1e3a5f", color: "#93c5fd" }}>
                  {vadLabel}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 py-3" style={{ background: "#1e293b", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {/* Mic button with VAD ring */}
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-shrink-0">
                {isListening && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "#ef4444",
                      animation: "pulse-ring 1s ease-out infinite",
                    }}
                  />
                )}
                <button
                  onClick={startListening}
                  disabled={isLoading || vadStatus === "processing" || vadStatus === "sending"}
                  className="relative flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: 40,
                    height: 40,
                    background: isListening ? "#ef4444" : "#1e3a5f",
                    color: "white",
                    border: isListening ? "2px solid #fca5a5" : "2px solid #2563eb",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.5 : 1,
                  }}
                  title={isListening ? "Aufnahme stoppen" : "Spracheingabe starten"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>

              <form
                className="flex-1 flex gap-2"
                onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isListening ? "Sprechen Sie jetzt…" : "Frage stellen..."}
                  disabled={isLoading || isListening}
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none transition-colors"
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid rgba(255,255,255,0.1)",
                    opacity: isListening ? 0.5 : 1,
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading || isListening}
                  className="flex items-center justify-center rounded-xl transition-all"
                  style={{
                    width: 38,
                    height: 38,
                    background: inputText.trim() && !isLoading ? "#2563eb" : "#1e293b",
                    color: "white",
                    border: "none",
                    cursor: inputText.trim() && !isLoading ? "pointer" : "not-allowed",
                    opacity: inputText.trim() && !isLoading ? 1 : 0.4,
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>

            {/* Hint text */}
            <p className="text-center text-xs" style={{ color: "#475569" }}>
              {isListening
                ? "Sprechen Sie – nach einer Pause wird automatisch gesendet"
                : "Mikrofon oder Texteingabe · WM Weibel Mueller AG"}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </>
  );
}
