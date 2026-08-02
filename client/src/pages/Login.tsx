import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, ArrowRight, AlertCircle, CheckCircle, Sparkles, FileText } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (err) => {
      if (err.message.includes("bestätigen Sie zuerst")) {
        setNeedsVerification(true);
        setError(null);
      } else {
        setError(err.message);
        setNeedsVerification(false);
      }
    },
  });

  const resendMutation = trpc.auth.resendVerification.useMutation({
    onSuccess: () => { setNeedsVerification(false); setError(null); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    loginMutation.mutate({ email, password });
  };

  const handleResendVerification = () => {
    resendMutation.mutate({ email, origin: window.location.origin });
  };

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Editorial Left Pane */}
      <div
        className="hidden lg:flex relative flex-1 flex-col justify-between p-12 xl:p-16"
        style={{
          background: "linear-gradient(135deg, var(--paper) 0%, #F1ECE2 100%)",
          borderRight: "1px solid var(--hair)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center"
            style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
          >
            <span className="font-semibold text-[14px]">K</span>
          </div>
          <span className="display text-[18px] font-medium">KLAX</span>
        </div>

        {/* Floating Receipt Card */}
        <div
          className="absolute top-24 left-16 xl:left-24 w-[220px] transform -rotate-2"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-3)",
            padding: 14,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--ai) 0%, #6B5AA8 100%)", color: "#fff" }}
            >
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--ai)" }}>
              Klax hat erkannt
            </span>
          </div>
          <div className="text-[11px] mb-2" style={{ color: "var(--ink-3)" }}>
            Rechnung · SBB AG
          </div>
          <div className="space-y-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
            <div className="flex justify-between"><span>Datum</span><span className="mono">23.04.2026</span></div>
            <div className="flex justify-between"><span>Betrag</span><span className="mono font-medium">CHF 142.50</span></div>
            <div className="flex justify-between"><span>MWST</span><span className="mono">8.1%</span></div>
            <div className="flex justify-between"><span>Konto</span><span className="mono">6100</span></div>
          </div>
          <div
            className="mt-3 pt-2 flex items-center justify-between text-[10px]"
            style={{ borderTop: "1px solid var(--hair)", color: "var(--ink-3)" }}
          >
            <span>Confidence</span>
            <span className="conf">
              <span className="conf-bar"><i style={{ width: "94%" }} /></span>
              94%
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="max-w-[520px] space-y-6 mt-auto mb-16">
          <h1 className="display text-[44px] xl:text-[56px] leading-[1.05] font-medium" style={{ color: "var(--ink)" }}>
            Buchhaltung,<br />die mitdenkt.
          </h1>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            KLAX verarbeitet Belege automatisch, matcht Bankbewegungen und
            bereitet Buchungsvorschläge für die Freigabe vor.
            Du entscheidest – die KI arbeitet.
          </p>
          <ul className="space-y-3 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            {[
              "OCR + Kategorisierung in unter 3 Sekunden",
              "CAMT.053 Bank-Import mit automatischem Matching",
              "OR 957 konforme Audit-Trails",
            ].map(t => (
              <li key={t} className="flex items-center gap-2.5">
                <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "var(--klax-accent)" }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-[11px]" style={{ color: "var(--ink-4)" }}>
          © {new Date().getFullYear()} Weibel-Müller AG · Schweizer Buchhaltungsstandard
        </div>
      </div>

      {/* Login Form Right */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center"
              style={{ background: "var(--klax-accent)", color: "var(--klax-accent-ink)" }}
            >
              <span className="font-semibold">K</span>
            </div>
            <span className="display text-[18px] font-medium">KLAX</span>
          </div>

          <div className="mb-6">
            <h2 className="display text-[28px] font-medium" style={{ color: "var(--ink)" }}>
              Willkommen zurück
            </h2>
            <p className="text-[13.5px] mt-1.5" style={{ color: "var(--ink-3)" }}>
              Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {needsVerification && (
              <div
                className="p-3 rounded-md flex items-start gap-2"
                style={{ background: "var(--warn-soft)", border: "1px solid color-mix(in oklab, var(--warn) 20%, transparent)", color: "var(--warn)" }}
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="text-[13px]">
                  Bitte bestätige zuerst deine E-Mail-Adresse.{" "}
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="underline font-medium"
                    disabled={resendMutation.isPending}
                  >
                    {resendMutation.isPending ? "Wird gesendet..." : "Erneut senden"}
                  </button>
                  {resendMutation.isSuccess && (
                    <span className="ml-2" style={{ color: "var(--pos)" }}>
                      <CheckCircle className="inline h-3 w-3 mr-1" />Gesendet!
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12.5px]">E-Mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ink-4)" }} />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@beispiel.ch"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-10"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[12.5px]">Passwort</Label>
                <Link
                  href="/forgot-password"
                  className="text-[12px] hover:underline"
                  style={{ color: "var(--klax-accent)" }}
                >
                  Passwort vergessen?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ink-4)" }} />
                <Input
                  id="password"
                  type="password"
                  placeholder="Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-10"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Wird angemeldet...</>
              ) : (
                <>Anmelden <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid var(--hair)" }} />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span
                className="px-3"
                style={{ background: "var(--paper)", color: "var(--ink-4)" }}
              >
                oder
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-10"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Mit Manus-Konto anmelden
          </Button>

          <p className="text-center text-[13px] mt-6" style={{ color: "var(--ink-3)" }}>
            Noch kein Konto?{" "}
            <Link
              href="/register"
              className="font-medium hover:underline"
              style={{ color: "var(--klax-accent)" }}
            >
              Jetzt registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
