# Handoff: KLAX Redesign — WM Buchhaltung

## Overview
Komplettes visuelles Redesign der WM-Buchhaltung App (Produktname: **KLAX**). Umfasst alle Frontend-Seiten: Dashboard, Inbox, Belege, Bank/Matching, Freigaben, Rechnungen, Berichte, MWST, Kreditoren, Kontenplan, Kontendetail, Globale KI-Regeln, Einstellungen, Jahresabschluss, Offene Posten/Mahnwesen, Lohnbuchhaltung, QR-Rechnung, Kreditkarten-Abrechnung, Zeiterfassung, Login, Onboarding — plus Mobile-Varianten und einen klickbaren Beleg-Flow-Prototyp.

## Über die Design-Dateien
Die Dateien in diesem Paket sind **Design-Referenzen in HTML** — Hi-Fi-Prototypen, die das gewünschte Aussehen und Verhalten zeigen. Sie sind **kein Produktionscode**. Die Aufgabe ist, diese Designs im bestehenden React/TypeScript/Tailwind/shadcn-Stack des Repos `MarcWeibel1971/WM-Buchhaltung` nachzubauen, unter Verwendung der vorhandenen Komponenten-Bibliothek und Patterns.

**Repo:** `MarcWeibel1971/WM-Buchhaltung` (Branch `main`)
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + tRPC + Wouter
**Branch für Redesign:** `redesign/klax` (neu anlegen)

## Fidelity
**High-fidelity (hifi)**: Pixel-perfekte Mockups mit finalen Farben, Typografie, Spacing und Interaktionen. Der Entwickler soll die UI möglichst genau im bestehenden Stack nachbauen.

---

## Design-Prinzipien
1. **Belege zuerst** — Der Nutzer startet mit Belegen, nicht mit Buchungssätzen
2. **KI ist sichtbar** — Confidence-Bars, violette KI-Hinweise, eigener Copilot-Dock
3. **Ruhige Zahlen** — Tabular, monospaced, rechtsbündig. Farbe nur bei Information
4. **Papier, nicht Chrom** — Warme Neutrals, weiche Schatten, 1px Haarlinien

---

## Design Tokens (NEU → ersetzt bestehende `index.css` Variablen)

### Typografie
| Token | Wert |
|---|---|
| `--font-sans` | `"Geist", "Inter", system-ui, sans-serif` |
| `--font-display` | `"Geist", "Inter", system-ui, sans-serif` |
| `--font-mono` | `"Geist Mono", "JetBrains Mono", ui-monospace, monospace` |

Google Fonts laden: `Geist:wght@300;400;500;600;700` + `Geist Mono:wght@400;500`
(Inter + JetBrains Mono als Fallback beibehalten)

### Neutrals (warm, papierartig)
| Token | Hex | Verwendung |
|---|---|---|
| `--paper` | `#FBFAF7` | App-Hintergrund |
| `--surface` | `#FFFFFF` | Karten |
| `--surface-2` | `#F5F3EE` | Subtile Fills, aktive Filter |
| `--hair` | `#EAE6DE` | Haarlinien, Borders |
| `--hair-strong` | `#D8D2C6` | Stärkere Borders |
| `--ink` | `#1A1917` | Primärtext |
| `--ink-2` | `#3E3B36` | Sekundärtext |
| `--ink-3` | `#6B675F` | Muted Text |
| `--ink-4` | `#9A958B` | Placeholder |

### Akzentfarbe (Standard: "Klee" Moosgrün)
| Token | Hex |
|---|---|
| `--accent` | `#2F4A3A` |
| `--accent-ink` | `#E9F0EA` |
| `--accent-soft` | `#E4EAE2` |
| `--accent-line` | `#C7D2C2` |

### Semantische Farben
| Token | Hex | Verwendung |
|---|---|---|
| `--pos` / `--pos-soft` | `#2E6B3F` / `#E0ECDF` | Positiv, Genehmigt, Gematcht |
| `--warn` / `--warn-soft` | `#8A5A10` / `#F4E9C9` | Pending, Warnung |
| `--neg` / `--neg-soft` | `#8A2B1F` / `#F1DAD3` | Negativ, Abgelehnt, Überfällig |
| `--info` / `--info-soft` | `#1E4A7A` / `#DDE6F0` | Info, Versendet |

### KI-Ton (eigenständig, violett)
| Token | Hex |
|---|---|
| `--ai` | `#4B3A7A` |
| `--ai-soft` | `#ECE6F5` |
| `--ai-line` | `#C8BBE4` |

### Radius & Elevation
| Token | Wert |
|---|---|
| `--r-sm` | `6px` |
| `--r-md` | `10px` |
| `--r-lg` | `14px` |
| `--r-xl` | `20px` |
| `--shadow-1` | `0 1px 0 rgba(23,20,15,.04), 0 1px 2px rgba(23,20,15,.04)` |
| `--shadow-2` | `0 4px 14px -6px rgba(23,20,15,.10), 0 1px 3px rgba(23,20,15,.05)` |
| `--shadow-3` | `0 24px 48px -20px rgba(23,20,15,.18), 0 2px 6px rgba(23,20,15,.06)` |

---

## Tailwind-Mapping (für `index.css`)

Die bestehenden shadcn-Variablen (`--background`, `--foreground`, `--primary`, etc.) müssen auf die neuen Tokens gemappt werden:

```css
:root {
  --background: #FBFAF7;        /* paper */
  --foreground: #1A1917;        /* ink */
  --card: #FFFFFF;              /* surface */
  --card-foreground: #1A1917;
  --primary: #2F4A3A;           /* accent */
  --primary-foreground: #E9F0EA;
  --secondary: #F5F3EE;         /* surface-2 */
  --secondary-foreground: #3E3B36;
  --muted: #F5F3EE;
  --muted-foreground: #6B675F;  /* ink-3 */
  --accent: #F5F3EE;
  --accent-foreground: #1A1917;
  --destructive: #8A2B1F;       /* neg */
  --destructive-foreground: #F1DAD3;
  --border: #EAE6DE;            /* hair */
  --input: #EAE6DE;
  --ring: #2F4A3A;              /* accent */
  --radius: 0.625rem;           /* 10px = r-md */
  --sidebar: #FBFAF7;
  --sidebar-foreground: #1A1917;
  --sidebar-primary: #2F4A3A;
  --sidebar-primary-foreground: #E9F0EA;
  --sidebar-accent: #F5F3EE;
  --sidebar-accent-foreground: #1A1917;
  --sidebar-border: #EAE6DE;
}
```

---

## Sidebar-Struktur (NEU — ersetzt bestehende)

```
Dashboard
Inbox [badge: count]

── Belege
Alle Belege [badge: count]
  ↳ Neu hochgeladen
  ↳ KI-verarbeitet
  ↳ Zu prüfen

── Bank & Zahlungen
Banktransaktionen [badge: count]
  ↳ Ungematcht
  ↳ Konten & Karten
Kreditoren [badge: count]
  ↳ Offene Posten

── Freigaben
Bereit zur Freigabe [badge: count]
  ↳ Mit Warnungen
  ↳ Verbucht

── Rechnungen
Ausgangsrechnungen
  ↳ Offene Forderungen
  ↳ Mahnwesen

── Buchhaltung
Kontenplan
  ↳ Kontendetail

── Berichte
Erfolgsrechnung
  ↳ Bilanz
  ↳ Cashflow

── Abschluss
MWST
  ↳ Jahresabschluss

── Admin
KI-Regeln

──────
Einstellungen
[Avatar] Weibel-Müller AG · GJ 2026 · R. Müller
```

Sidebar-Breite: **232px**. Aktives Item: `background: var(--accent); color: var(--accent-ink)`.
Gruppen-Label: 10.5px, uppercase, letter-spacing 0.08em, color ink-4.
Sub-Items: padding-left 32px, font-size 12.5px, color ink-3.

---

## Globale UI-Komponenten

### Buttons
- **Primary**: `bg: accent, color: accent-ink, border: accent, shadow-1`
- **Default**: `bg: surface, color: ink, border: hair, shadow-1`
- **Ghost**: `bg: transparent, no border, no shadow, color: ink-2`
- **Small**: `padding: 6px 10px, font-size: 12px`
- Alle: `border-radius: r-sm (6px), font-weight: 500, gap: 8px`

### Pills / Badges
- Rund (`border-radius: 999px`), 11px font, 500 weight
- Varianten: `default` (surface-2 bg), `accent`, `ai` (violett), `pos` (grün), `warn` (gelb), `neg` (rot), `info` (blau)
- Mit optionalem Icon (11px) links

### Cards
- `bg: surface, border: 1px solid hair, border-radius: r-lg (14px), shadow-1`
- Soft-Variante: `bg: surface-2, no shadow`

### Tabellen (`k-table`)
- Header: 10.5px uppercase, letter-spacing 0.08em, color ink-3, font-weight 500
- Cells: padding 12px, border-bottom 1px hair, font-size 13px
- Hover: background surface-2

### Confidence-Bar (KI)
- Inline: 32px breiter Balken (4px hoch), background hair, Füllung mit --ai-Farbe
- Daneben: mono Prozentzahl, 11px, color ink-3

### Copilot-Dock
- Feste Position unten rechts, `background: ink, color: #F4F1EA, border-radius: 999px`
- Lila Sparkle-Icon (gradient), Text "Frag Klax …", Keyboard shortcut ⌘J

### Beträge
- Immer `font-family: mono, font-variant-numeric: tabular-nums`
- Positiv: color `--pos`, Negativ: color `--neg`, Neutral: color `--ink`

---

## Screens / Views — Detailbeschreibungen

### 1. Dashboard (`pages/Dashboard.tsx`)
- **Topbar**: "Guten Morgen, [Name]." + Firma/GJ/KW + CTAs (Beleg hochladen, Rechnung erstellen)
- **KI-Hero-Card**: Gradient-Background (paper → #F6F2EB), AI-Icon + "KLAX HAT FÜR DICH VORBEREITET", natürlichsprachiger Satz mit unterstrichenen Zahlen, CTAs, rechts 3 KPI-Zahlen (Automatisierung/Match-Quote/Verarbeitung)
- **Heute zu erledigen**: 4-Spalten-Grid mit Aufgaben-Karten (Icon + Zahl + Label + Pfeil)
- **Finanzstatus**: Card mit 3 KPIs (Liquidität, Forderungen, Ergebnis) + Balkendiagramm (12 Monate, Ertrag + Aufwand)
- **Aktivität**: Feed mit Zeitstempel, AI-Badge, Status-Icons

### 2. Inbox (`pages/Inbox.tsx`)
- Zweispaltig: Links Filter-Rail (280px) mit Stapeln + KI-Pipeline-Stats + Quellen; Rechts Freigabe-Liste gruppiert nach Lieferant
- Jede Gruppe: Accordion mit Header (Vendor, Konto, Count, Total, "Gruppe freigeben" CTA)
- Einzelne Items: Checkbox + ID + Beschreibung + Confidence-Bar + MWST-Pill + Betrag

### 3. Belege Liste (`pages/Documents.tsx` / `Belege.tsx`)
- Tabs: Alle / Neu / KI-verarbeitet / Zu prüfen / Gematcht / Archiv (Pill-Style)
- Suchfeld rechts
- Tabelle: Datum, Lieferant (mit PDF-Thumbnail), Konto, MWST, KI-Confidence, Match-Status, Betrag

### 4. Beleg Detail (`pages/DocumentDetail.tsx`)
- Zweispaltig: Links PDF-Preview (auf surface-2 Background), Rechts KI-Panel
- KI-Panel: AI-Badge + Confidence + natürlichsprachige Analyse + extrahierte Felder (Key-Value mit Confidence) + Buchungsvorschlag (Soll/Haben/Betrag) + Bank-Match (grüne Card mit Link-Icon)

### 5. Bank / Matching (`pages/BankImport.tsx` / `Bank.tsx`)
- Tabs: Alle / Ungematcht / KI-Vorschlag / Gematcht
- Jede Transaktion: Card mit Datum/Beschreibung/Betrag + Match-Strip unten (grün = auto-gematcht, gelb = KI-Vorschlag mit Annehmen-Button)

### 6. Freigaben (`pages/Journal.tsx` / `Freigaben.tsx`)
- Tabs: Bereit / Warnungen / Manuell angepasst / Verbucht (Underline-Tabs)
- Tabelle: Nr, Datum, Buchungstext, Soll, Haben, Quelle (Pill), KI-Confidence, Betrag
- Warnungen: gelber Row-Background mit Warn-Icon + Text
- Footer: Audit-Trail-Hinweis (OR 957)

### 7. Rechnungen (`pages/Invoices.tsx`)
- 4 KPI-Karten: Offen, Überfällig, Bezahlt YTD, Entwürfe
- Tabs: Alle / Offen / Überfällig / Bezahlt / Entwürfe / Mahnwesen
- Tabelle: Nr, Kunde (mit Avatar-Initialen), Datum, Fällig, Status-Pill, Betrag, Offen

### 8. Erfolgsrechnung (`pages/Reports.tsx`)
- Zweispaltig: Links Bericht (Perioden-Switcher + Tabelle mit Balken-Visualisierung pro Zeile), Rechts Insights (KI-Narrative + Vertikalstruktur-Bars)
- Hervorgehobene Zeilen (EBIT) mit accent-soft Background

### 9. MWST (`pages/Vat.tsx`)
- Zweispaltig: Links Stepper (5 Schritte) + MWST-Formular (Umsatz/Steuer/Vorsteuer/Saldo), Rechts KI-Prüfungs-Checkliste
- Saldo-Zeile: accent-Background mit grosser Zahl

### 10. Kreditoren (`pages/Kreditoren.tsx`)
- Kontextleiste: Belastungskonto + Ausführungsdatum + Status-Pills
- KI-Hinweis: AI-soft Background mit Auto-Auswahl-Info
- Tabelle: Checkbox + Kreditor + IBAN + Ort + Datum + Fällig + Betrag + QR-Ref + Status
- Footer: Selected-Count + Total + pain.001-Export-Button

### 11. Kontenplan (`pages/Accounts.tsx`)
- 5 Summary-Karten (Aktiven/Passiven/EK/Ertrag/Aufwand)
- Filter-Bar + Typ-Tabs
- Gruppierte Tabellen nach Kontotyp, farbcodierte Sidebar-Streifen

### 12. Kontendetail (Account Ledger)
- 4 KPI-Karten: Eröffnung, Total Soll (grün), Total Haben (rot), Schlusssaldo (accent)
- Filter: Suche + Datumsbereich
- Ledger-Tabelle: Datum, Buchungstext, Beleg-Nr, Soll, Haben, Saldo (laufend)
- Schlusssaldo-Zeile bold mit surface-2 Background

### 13. Globale KI-Regeln (`pages/GlobalRules.tsx`)
- 6 Stat-Karten (Regeln/Aktiv/Inaktiv/Manuell/KI/Anwendungen)
- 3-Ebenen-Info-Card (Kundenspezifisch → Global → LLM)
- Tabelle: Toggle (Switch), Pattern, Buchungstext, Soll/Haben (Pills), Kategorie, MWST, Prio, Quelle (AI/Manuell Pill), Nutzung

### 14. Einstellungen (`pages/Settings.tsx`)
- Zweispaltig: Links Sub-Navigation (10 Sections), Rechts Content
- Firma-Section: Logo-Upload + Formularfelder (2-Spalten-Grid)
- Geschäftsjahr: Card mit Progress-Bar (Tag X von 365)
- Regionales: Währung/Sprache/Datumsformat

### 15. Jahresabschluss (`pages/YearEnd.tsx`)
- GJ-Tabs (2023–2026) mit Status-Badges
- 5-Schritt-Stepper (farbcodiert: done=grün, active=accent, idle=grau)
- 4 KPI-Karten
- KI-Callout (AI-soft, Haiku 4.5 Badge)
- Akkordeon-Gruppen: Trans. Passiven/Aktiven, Kreditoren, Abschreibungen — mit Genehmigen/Ablehnen-Buttons pro Zeile

### 16. Offene Posten / Mahnwesen (`pages/OpenPositions.tsx`)
- 4 KPIs: Offene Forderungen, Überfällig (rot), Ø Zahlungsziel, KLAX-Prognose (AI)
- Altersstruktur-Barchart (4 Buckets)
- Tabelle: Nr, Kunde, Datum, Fällig, Betrag, Überfällig (+X Tage), Mahnstufe (gestaffelt), Aktion-Button

### 17. Lohnbuchhaltung (`pages/Payroll.tsx`)
- Monats-Tabs (Jan–Dez, erledigt = Häkchen)
- 5 KPI-Karten (Brutto, AN-Beiträge, BVG, UVG, Netto)
- Sozialversicherungssätze-Leiste (2026)
- Tabelle: Name/Rolle, AHV-Nr, Brutto, AHV, ALV, KTG, BVG, UVG, Netto — mit Totals-Row

### 18. QR-Rechnung (`pages/QrBillGenerator.tsx`)
- Zweispaltig: Links Formular (Empfänger + Rechnungsdaten), Rechts Live-Vorschau mit Zahlschein
- QR-Code-Placeholder, Swiss QR Standard Zahlteil-Layout

### 19. Kreditkarten-Abrechnung (`pages/CreditCard.tsx`)
- Card-Visualisierung (dunkle Kreditkarte mit Kartennummer)
- 4 KPIs: Abrechnung, Kontiert, Zu prüfen, Kreditlimit (mit Fortschrittsbalken)
- Tabelle: Datum, Händler (mit Warnung für unsichere Kategorien), Konto, MWST, Confidence, Betrag, Status

### 20. Zeiterfassung (`pages/TimeTracking.tsx`)
- 4 KPIs: Total Stunden (mit Fortschritt), Verrechenbar, Umsatz KW, Monats-Total
- KW-Tabs
- Tagesweise Entries: Projekt + Task + Stunden + Rate-Pill + Betrag
- Placeholder für zukünftige Tage (dashed border)

### 21. Login
- Zweispaltig: Links Editorial (grosse Headline "Buchhaltung, die mitdenkt." + USPs), Rechts Login-Form
- Links oben: Floating Receipt-Card mit KI-Badge

### 22. Onboarding
- Stepper-Navigation (5 Schritte: Firma, Kontenplan, Bank, Belege, Fertig)
- Step 3: Bank verbinden — Radiobutton-Liste mit CH-Banken
- Rechts: Live-Preview "So wird dein Dashboard aussehen"

---

## Migrations-Checkliste für Claude Code

1. [ ] Branch `redesign/klax` von `main` anlegen
2. [ ] `index.css`: Alle CSS-Variablen durch neue Tokens ersetzen (siehe Tailwind-Mapping oben)
3. [ ] Google Font `Geist` + `Geist Mono` laden (bestehende Inter + JetBrains Mono als Fallback)
4. [ ] Sidebar (`DashboardLayout.tsx`): Neue Struktur implementieren (siehe Sidebar-Struktur)
5. [ ] Accounting-Utilities in `index.css` anpassen: `.amount-positive` → `--pos`, `.amount-negative` → `--neg`
6. [ ] Neue CSS-Klassen hinzufügen: `.pill--ai`, `.pill--pos`, `.pill--warn`, `.pill--neg`, `.pill--info`, `.conf`, `.conf-bar`
7. [ ] Pro Page: Layout und Datenstruktur beibehalten, visuellen Stil anpassen
8. [ ] KI-Copilot-Dock als globale Komponente (`CopilotDock.tsx`) erstellen
9. [ ] Confidence-Bar-Komponente erstellen (für KI-Scores)
10. [ ] AI-Callout-Komponente erstellen (violetter Hinweis mit Sparkle-Icon)
11. [ ] Alle Seiten auf neue Farbvariablen umstellen
12. [ ] Radius von `0.65rem` auf `0.625rem` (10px) anpassen
13. [ ] Card-Border-Radius auf `14px` (`--r-lg`) erhöhen

---

## Design-Dateien

| Datei | Inhalt |
|---|---|
| `KLAX Redesign.html` | Design System + Login + Onboarding + Dashboard + Inbox + Belege + Bank + Freigaben + Rechnungen + Berichte + MWST + Mobile + Prototyp |
| `KLAX Redesign 02 Buchhaltung.html` | Kreditoren + Kontenplan + Kontendetail + KI-Regeln + Settings |
| `KLAX Redesign 03 Abschluss.html` | Jahresabschluss-Wizard + Offene Posten/Mahnwesen + Lohnlauf |
| `KLAX Redesign 04 Extras.html` | QR-Rechnung + Kreditkarte + Zeiterfassung |
| `assets/tokens.css` | Alle Design Tokens als CSS Custom Properties |
| `components/primitives.jsx` | Shared UI-Komponenten (Icon, Pill, Btn, Conf, Sidebar, Topbar, Frame) |
| `components/pages-*.jsx` | Page-Mockups als React-Komponenten (Referenz für Layouts) |
