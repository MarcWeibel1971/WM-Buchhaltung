import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Settings from "./Settings";
import { Loader2, ShieldOff } from "lucide-react";

/**
 * /admin – Organisationsweite Verwaltung (nur Admin-Rolle).
 *
 * Tabs werden über ?tab=... gesteuert (z.B. /admin?tab=benutzer).
 * Nutzt den gleichen Container wie /einstellungen, aber mit scope="admin".
 */
export default function Admin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      setLocation("/einstellungen", { replace: true } as any);
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--klax-accent)" }} />
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-full flex items-center justify-center p-8" style={{ background: "var(--paper)" }}>
        <div className="klax-card max-w-md p-6 text-center">
          <ShieldOff className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--ink-3)" }} />
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Kein Zugriff
          </h2>
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Der Admin-Bereich ist nur für Benutzer mit Admin-Rolle verfügbar.
          </p>
        </div>
      </div>
    );
  }

  return <Settings scope="admin" basePath="/admin" />;
}
