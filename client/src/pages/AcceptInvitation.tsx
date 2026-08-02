import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle, XCircle, Clock, UserPlus } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  bookkeeper: "Buchhalter",
  viewer: "Betrachter",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Vollzugriff auf alle Funktionen, inkl. Einstellungen und Benutzerverwaltung.",
  bookkeeper: "Kann Buchungen, Belege und Rechnungen bearbeiten.",
  viewer: "Nur-Lesen-Zugriff auf alle Daten.",
};

export default function AcceptInvitation() {
  const [, params] = useRoute("/einladung/:token");
  const token = params?.token ?? "";

  const { data: invitation, isLoading, error } = trpc.invitations.getByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const handleRegister = () => {
    // Redirect to register page with token pre-filled in URL
    const registerUrl = `/register?invitationToken=${encodeURIComponent(token)}`;
    window.location.href = registerUrl;
  };

  const handleLogin = () => {
    // Redirect to login page with return path
    const loginUrl = `/login?returnPath=${encodeURIComponent(`/einladung/${token}`)}`;
    window.location.href = loginUrl;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Einladung wird geladen...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-xl">Einladung ungültig</CardTitle>
            <CardDescription>
              {error?.message?.includes("expired")
                ? "Diese Einladung ist abgelaufen. Bitte fordern Sie eine neue Einladung an."
                : error?.message?.includes("used")
                ? "Diese Einladung wurde bereits verwendet."
                : "Diese Einladung ist nicht mehr gültig oder wurde widerrufen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => window.location.href = "/login"}>
              Zur Anmeldung
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = invitation.role as string;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleDescription = ROLE_DESCRIPTIONS[role] ?? "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">Sie wurden eingeladen</CardTitle>
          <CardDescription className="text-base mt-1">
            Sie wurden eingeladen, der Organisation{" "}
            <span className="font-semibold text-foreground">{invitation.orgName ?? "WM Buchhaltung"}</span>{" "}
            beizutreten.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Invitation details */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">E-Mail</span>
              <span className="text-sm font-medium">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rolle</span>
              <Badge variant="secondary">{roleLabel}</Badge>
            </div>
            <div className="flex items-start gap-2 pt-1">
              <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">{roleDescription}</p>
            </div>
          </div>

          {/* Expiry notice */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Diese Einladung ist 7 Tage gültig.</span>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <Button className="w-full" onClick={handleRegister}>
              <UserPlus className="h-4 w-4 mr-2" />
              Konto erstellen &amp; beitreten
            </Button>
            <Button variant="outline" className="w-full" onClick={handleLogin}>
              Bereits registriert? Anmelden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
