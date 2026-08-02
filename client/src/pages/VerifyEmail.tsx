import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";

export default function VerifyEmail() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setStatus(data.alreadyVerified ? "already" : "success");
    },
    onError: (err: { message: string }) => {
      setStatus("error");
      setErrorMessage(err.message);
    },
  });

  useEffect(() => {
    if (token) {
      verifyMutation.mutate({ token });
    } else {
      setStatus("error");
      setErrorMessage("Kein Verifizierungstoken gefunden.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-slate-200">
          <CardContent className="pt-8 pb-8 text-center">
            {status === "loading" && (
              <>
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">E-Mail wird bestätigt...</h2>
                <p className="text-muted-foreground">Bitte warten Sie einen Moment.</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">E-Mail bestätigt!</h2>
                <p className="text-muted-foreground mb-6">
                  Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie können sich jetzt anmelden.
                </p>
                <Button asChild className="w-full">
                  <Link href="/login">
                    Zur Anmeldung
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </>
            )}

            {status === "already" && (
              <>
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Bereits bestätigt</h2>
                <p className="text-muted-foreground mb-6">
                  Ihre E-Mail-Adresse wurde bereits bestätigt. Sie können sich anmelden.
                </p>
                <Button asChild className="w-full">
                  <Link href="/login">
                    Zur Anmeldung
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Verifizierung fehlgeschlagen</h2>
                <p className="text-muted-foreground mb-6">
                  {errorMessage || "Der Verifizierungslink ist ungültig oder abgelaufen."}
                </p>
                <div className="space-y-3">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">
                      Zur Anmeldung
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
