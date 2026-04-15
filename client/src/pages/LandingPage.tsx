import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Calculator, Shield, BarChart3, FileText, Users, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-slate-900">WM-Buchhaltung</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Anmelden</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">
                  Kostenlos starten
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-slate-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Zap className="h-4 w-4" />
              Speziell für Schweizer KMU
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight mb-6">
              Buchhaltung,{" "}
              <span className="text-blue-600">maximal einfach.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl mx-auto">
              Die moderne Buchhaltungslösung für Schweizer KMU. Automatisierte Bankimporte,
              MWST-Abrechnung, QR-Rechnungen und mehr – alles in einer intuitiven Oberfläche.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="text-base px-8 py-3 h-auto" asChild>
                <Link href="/register">
                  Jetzt kostenlos registrieren
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 py-3 h-auto" asChild>
                <a href="#features">Funktionen entdecken</a>
              </Button>
            </div>
            <p className="text-sm text-slate-500 mt-4">Keine Kreditkarte erforderlich. 30 Tage kostenlos testen.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Alles, was Sie für Ihre Buchhaltung brauchen
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Von der täglichen Buchführung bis zur Jahresabschluss – WM-Buchhaltung deckt alle Bereiche ab.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Calculator,
                title: "Doppelte Buchhaltung",
                description: "Professionelle doppelte Buchführung nach Schweizer Standard mit automatischer Kontierung und Belegzuordnung.",
              },
              {
                icon: FileText,
                title: "QR-Rechnungen",
                description: "Erstellen Sie Swiss QR-Rechnungen direkt aus der App. Inklusive automatischer ESR-Referenznummern.",
              },
              {
                icon: BarChart3,
                title: "Bankimport",
                description: "Importieren Sie Bankauszüge automatisch. Intelligente Zuordnung dank KI-gestützter Buchungsvorschläge.",
              },
              {
                icon: Shield,
                title: "MWST-Abrechnung",
                description: "Automatische MWST-Berechnung und -Abrechnung. Kompatibel mit der Eidg. Steuerverwaltung.",
              },
              {
                icon: Users,
                title: "Lohnbuchhaltung",
                description: "Verwalten Sie Mitarbeiter und Lohnabrechnungen. Inklusive AHV, BVG und Quellensteuer-Berechnung.",
              },
              {
                icon: Zap,
                title: "KI-Unterstützung",
                description: "Automatische Dokumentenerkennung, intelligente Buchungsvorschläge und Belegzuordnung dank KI.",
              },
            ].map((feature, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all duration-200">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                Warum Schweizer KMU auf WM-Buchhaltung setzen
              </h2>
              <div className="space-y-5">
                {[
                  "Speziell für den Schweizer Kontenrahmen (KMU) entwickelt",
                  "Automatische MWST-Sätze (8.1%, 2.6%, 3.8%)",
                  "Swiss QR-Rechnungen nach ISO 20022",
                  "Bankimport mit intelligenter Kontierung",
                  "Mehrmandantenfähig – mehrere Firmen verwalten",
                  "Sicher gehostet in der Schweiz",
                  "Regelmässige Updates und Support",
                ].map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-slate-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
              <div className="text-center">
                <p className="text-sm font-medium text-blue-600 mb-2">Starten Sie jetzt</p>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">30 Tage kostenlos testen</h3>
                <p className="text-slate-600 mb-6">
                  Testen Sie alle Funktionen unverbindlich. Keine Kreditkarte erforderlich.
                </p>
                <Button size="lg" className="w-full text-base py-3 h-auto" asChild>
                  <Link href="/register">
                    Kostenlos registrieren
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Einfache, transparente Preise
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Wählen Sie den Plan, der zu Ihrem Unternehmen passt. Alle Pläne inklusive 30 Tage kostenlose Testphase.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Starter</h3>
              <p className="text-sm text-slate-500 mb-4">Für Einzelunternehmen</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">CHF 29</span>
                <span className="text-slate-500">/Monat</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["1 Firma", "Doppelte Buchhaltung", "QR-Rechnungen", "Bankimport", "MWST-Abrechnung"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/register">Kostenlos testen</Link>
              </Button>
            </div>

            {/* Professional */}
            <div className="rounded-2xl border-2 border-blue-600 p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Beliebt</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Professional</h3>
              <p className="text-sm text-slate-500 mb-4">Für wachsende KMU</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">CHF 59</span>
                <span className="text-slate-500">/Monat</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["Bis 3 Firmen", "Alles aus Starter", "Lohnbuchhaltung", "KI-Buchungsvorschläge", "Dokumenten-Scan", "Kreditoren-Verwaltung"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full" asChild>
                <Link href="/register">Kostenlos testen</Link>
              </Button>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Enterprise</h3>
              <p className="text-sm text-slate-500 mb-4">Für Treuhandgesellschaften</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">CHF 99</span>
                <span className="text-slate-500">/Monat</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["Unbegrenzte Firmen", "Alles aus Professional", "Zeiterfassung", "Mandanten-Verwaltung", "Prioritäts-Support", "Individuelle Anpassungen"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/register">Kostenlos testen</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Bereit, Ihre Buchhaltung zu vereinfachen?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Starten Sie noch heute mit WM-Buchhaltung und erleben Sie, wie einfach Schweizer Buchhaltung sein kann.
          </p>
          <Button size="lg" variant="secondary" className="text-base px-8 py-3 h-auto bg-white text-blue-600 hover:bg-blue-50" asChild>
            <Link href="/register">
              Jetzt kostenlos registrieren
              <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-300">WM-Buchhaltung</span>
            </div>
            <p className="text-sm">&copy; {new Date().getFullYear()} WM Weibel Mueller AG. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
