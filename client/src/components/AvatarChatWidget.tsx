import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { AvatarScene } from "./AvatarScene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export function AvatarChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Guten Tag! Ich bin Ihr digitaler Buchhaltungsberater. Wie kann ich Ihnen heute helfen?",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const conversationHistoryRef = useRef<{ role: string; content: string }[]>([]);

  const VRM_URL = "/manus-storage/advisor_avatar_c531768f.vrm";

  // tRPC mutations
  const avatarChatMutation = trpc.avatarChat.chat.useMutation();
  const transcribeVoiceMutation = trpc.avatarChat.transcribeVoice.useMutation();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setHasNewMessage(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // ── TTS via browser Web Speech API ─────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setAudioAnalyser(null);
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (isMuted || !text.trim()) return;
      stopSpeaking();

      if (!("speechSynthesis" in window)) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-CH";
      utterance.rate = 0.95;
      utterance.pitch = 0.9;
      utterance.volume = 1.0;

      // Try to find a German voice
      const voices = window.speechSynthesis.getVoices();
      const germanVoice =
        voices.find((v) => v.lang === "de-CH") ||
        voices.find((v) => v.lang === "de-DE") ||
        voices.find((v) => v.lang.startsWith("de"));
      if (germanVoice) utterance.voice = germanVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        setAudioAnalyser(null);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setAudioAnalyser(null);
      };

      speechSynthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isMuted, stopSpeaking]
  );

  // ── TTS via audio URL (ElevenLabs) ─────────────────────────────────────────

  const playAudioUrl = useCallback(
    async (audioUrl: string) => {
      if (isMuted) return;
      stopSpeaking();

      try {
        const audio = new Audio(audioUrl);

        // Set up AudioContext for lip-sync analyser
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        if (audioSourceRef.current) {
          audioSourceRef.current.disconnect();
        }
        const source = ctx.createMediaElementSource(audio);
        audioSourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        setAudioAnalyser(analyser);
        setIsSpeaking(true);

        audio.onended = () => {
          setIsSpeaking(false);
          setAudioAnalyser(null);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setAudioAnalyser(null);
        };

        await audio.play();
      } catch (err) {
        console.error("Audio playback error:", err);
        setIsSpeaking(false);
        setAudioAnalyser(null);
      }
    },
    [isMuted, stopSpeaking]
  );

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsLoading(true);

      // Build conversation history for context
      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { role: "user", content: text.trim() },
      ].slice(-10); // Keep last 10 messages

      try {
        const result = await avatarChatMutation.mutateAsync({
          message: text.trim(),
          conversationHistory: conversationHistoryRef.current.slice(0, -1),
        });

        const replyText = typeof result.reply === 'string' ? result.reply : String(result.reply);
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

        // Play TTS
        if (result.audioUrl) {
          await playAudioUrl(result.audioUrl as string);
        } else {
          speakText(replyText);
        }

        // Notify if widget is closed
        if (!isOpen) {
          setHasNewMessage(true);
        }
      } catch (err) {
        console.error("Chat error:", err);
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content:
            "Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, avatarChatMutation, playAudioUrl, speakText, isOpen]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  // ── Voice recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Check size (max 16MB)
        if (blob.size > 16 * 1024 * 1024) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: "Die Aufnahme ist zu lang. Bitte sprechen Sie kürzer.",
              timestamp: new Date(),
            },
          ]);
          return;
        }

        setIsLoading(true);
        try {
          // Upload audio to S3 via upload endpoint
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const uploadRes = await fetch("/api/upload/voice", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) throw new Error("Upload failed");
          const { url } = await uploadRes.json();

          // Transcribe
          const transcribeResult = await transcribeVoiceMutation.mutateAsync({
            audioUrl: url,
            language: "de",
          });

          if (transcribeResult.text) {
            setInputText(transcribeResult.text);
            // Auto-send transcribed text
            await sendMessage(transcribeResult.text);
          }
        } catch (err) {
          console.error("Voice transcription error:", err);
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content:
                "Die Spracherkennung hat nicht funktioniert. Bitte tippen Sie Ihre Frage.",
              timestamp: new Date(),
            },
          ]);
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
    }
  }, [sendMessage, transcribeVoiceMutation]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded Chat Panel */}
      {isOpen && (
        <div className="w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: "560px" }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">
                WM Buchhaltungsberater
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsMuted((m) => !m);
                  if (!isMuted) stopSpeaking();
                }}
                className="text-white/80 hover:text-white p-1 rounded transition-colors"
                title={isMuted ? "Ton einschalten" : "Ton ausschalten"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded transition-colors"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* Avatar Scene */}
          <AvatarScene
            vrmUrl={VRM_URL}
            isSpeaking={isSpeaking}
            audioAnalyser={audioAnalyser}
            className="h-40 flex-shrink-0"
          />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 bg-gray-50 space-y-1">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-2">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-100 bg-white px-3 py-2">
            {isRecording && (
              <div className="flex items-center gap-2 mb-2 text-xs text-red-600 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                Aufnahme läuft... Klicken Sie auf das Mikrofon zum Beenden
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Frage stellen..."
                disabled={isLoading || isRecording}
                className="flex-1 text-sm h-9 bg-gray-50 border-gray-200"
              />
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isLoading}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  isRecording
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title={isRecording ? "Aufnahme stoppen" : "Spracheingabe"}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              WM Weibel Mueller AG · Buchhaltungsassistent
            </p>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={`relative w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? "bg-gray-600 hover:bg-gray-700"
            : "bg-blue-600 hover:bg-blue-700"
        } ${isSpeaking ? "ring-4 ring-blue-400 ring-opacity-60 animate-pulse" : ""}`}
        title={isOpen ? "Chat schliessen" : "Buchhaltungsberater öffnen"}
      >
        {isOpen ? (
          <X size={24} className="text-white" />
        ) : (
          <MessageCircle size={24} className="text-white" />
        )}
        {/* New message indicator */}
        {hasNewMessage && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[9px] font-bold">!</span>
          </span>
        )}
      </button>
    </div>
  );
}
