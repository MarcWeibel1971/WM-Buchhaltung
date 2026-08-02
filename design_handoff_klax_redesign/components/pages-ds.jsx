/* global React, Icon, Pill, Btn */
// KLAX Design System — tokens overview page
const DS = () => {
  const Sw = ({ c, l, sub }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: '100%', height: 64, borderRadius: 10, background: c, border: '1px solid var(--hair)' }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{l}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{sub}</div>
      </div>
    </div>
  );
  return (
    <div className="klax" style={{ width: 1440, height: 1800, padding: 56, background: 'var(--paper)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginBottom: 6 }}>
        <div className="display" style={{ fontSize: 56, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>klax</div>
        <Pill variant="accent">Design System v1</Pill>
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', maxWidth: 720, lineHeight: 1.55, marginTop: 10 }}>
        Die Designsprache für WM Buchhaltung. Warme, papiernahe Neutraltöne · ein einziger, ruhiger Akzent · monospaced Zahlen für Vertrauen · sichtbare KI als eigenständiger Ton (violett, de-saturiert). Gebaut auf der bestehenden shadcn/Tailwind-Basis.
      </div>

      {/* Principles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 40 }}>
        {[
          { h: 'Belege zuerst', t: 'Jede Seite startet mit dem Beleg, nicht mit der Buchung. Der Nutzer sortiert, Klax übersetzt.' },
          { h: 'KI ist sichtbar', t: 'Confidence-Bars, violette Hinweise, ein eigener Copilot-Dock. Nie ein Autopilot ohne Audit-Spur.' },
          { h: 'Ruhige Zahlen', t: 'Tabular, monospaced, rechtsbündig. Farbe nur wenn sie Information trägt (positiv, negativ, Warnung).' },
          { h: 'Papier, nicht Chrom', t: 'Warme Neutrals (#FBFAF7), weiche Schatten, 1px Haarlinien. Keine Glow-Gradients, keine Glassmorphism-Spielerei.' },
        ].map(p => (
          <div key={p.h} className="card" style={{ padding: 20 }}>
            <div className="display" style={{ fontSize: 16, fontWeight: 500 }}>{p.h}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>{p.t}</div>
          </div>
        ))}
      </div>

      {/* Typography */}
      <div className="label" style={{ marginTop: 48, marginBottom: 16 }}>Typografie</div>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 180px', alignItems: 'baseline', gap: 20, paddingBottom: 18, borderBottom: '1px solid var(--hair)' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Display · 56 / 0.95</div>
          <div className="display" style={{ fontSize: 56, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>Buchhaltung, die mitdenkt.</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Geist Medium</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 180px', alignItems: 'baseline', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--hair)' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>H1 · 28 / 1.2</div>
          <div className="display" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Dashboard</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Geist Medium</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 180px', alignItems: 'baseline', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--hair)' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Body · 13.5 / 1.55</div>
          <div style={{ fontSize: 13.5, maxWidth: 560 }}>Klax liest deine Belege, kontiert sie nach Schweizer Vorschriften und bereitet die MWST-Abrechnung vor. Du gibst nur noch frei.</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Geist Regular</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 180px', alignItems: 'baseline', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--hair)' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Label · 11 / 0.08em</div>
          <div className="label">Heute zu erledigen</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Geist Medium · UPPER</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 180px', alignItems: 'baseline', gap: 20, padding: '16px 0 0' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Numerik · tabular</div>
          <div className="num" style={{ fontSize: 28, fontWeight: 500, color: 'var(--pos)' }}>CHF 284’520.40</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Geist Mono</div>
        </div>
      </div>

      {/* Colors */}
      <div className="label" style={{ marginTop: 40, marginBottom: 16 }}>Farben</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
        <Sw c="#FBFAF7" l="Paper" sub="#FBFAF7" />
        <Sw c="#FFFFFF" l="Surface" sub="#FFFFFF" />
        <Sw c="#F5F3EE" l="Surface-2" sub="#F5F3EE" />
        <Sw c="#EAE6DE" l="Hair" sub="#EAE6DE" />
        <Sw c="#1A1917" l="Ink" sub="#1A1917" />
        <Sw c="#6B675F" l="Ink-3" sub="#6B675F" />
        <Sw c="var(--accent)" l="Accent · Klee" sub="#2F4A3A" />
        <Sw c="var(--accent-soft)" l="Accent Soft" sub="#E4EAE2" />
        <Sw c="#4B3A7A" l="AI" sub="#4B3A7A" />
        <Sw c="#ECE6F5" l="AI Soft" sub="#ECE6F5" />
        <Sw c="#2E6B3F" l="Positive" sub="#2E6B3F" />
        <Sw c="#8A2B1F" l="Negative" sub="#8A2B1F" />
      </div>

      {/* Components */}
      <div className="label" style={{ marginTop: 40, marginBottom: 16 }}>Komponenten</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 22 }}>
          <div className="label" style={{ marginBottom: 12 }}>Buttons</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="primary" icon="check">Freigeben</Btn>
            <Btn>Sekundär</Btn>
            <Btn variant="ghost" icon="plus">Ghost</Btn>
            <Btn size="sm" icon="upload">Small</Btn>
            <Btn variant="primary" size="sm" icon="sparkle">AI Action</Btn>
          </div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="label" style={{ marginBottom: 12 }}>Pills / Badges</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill>Default</Pill>
            <Pill variant="accent">Accent</Pill>
            <Pill variant="ai" icon="sparkle">KI 97%</Pill>
            <Pill variant="pos" icon="check">Gematcht</Pill>
            <Pill variant="warn" icon="warn">Prüfen</Pill>
            <Pill variant="neg" icon="warn">Überfällig</Pill>
            <Pill variant="info">Versendet</Pill>
          </div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="label" style={{ marginBottom: 12 }}>Confidence & Numerik</div>
          <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            {[60,75,88,97].map(v => <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="conf"><span className="conf-bar"><i style={{ width:`${v}%`}}/></span>{v}%</span>
            </div>)}
            <span className="num" style={{ fontSize: 15 }}>CHF 142.90</span>
            <span className="num" style={{ fontSize: 15, color: 'var(--pos)' }}>+4’280.00</span>
            <span className="num" style={{ fontSize: 15, color: 'var(--neg)' }}>−612.80</span>
          </div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="label" style={{ marginBottom: 12 }}>Elevation & Radius</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[{r:6,s:'var(--shadow-1)',l:'sm · 1'},{r:10,s:'var(--shadow-2)',l:'md · 2'},{r:14,s:'var(--shadow-3)',l:'lg · 3'}].map(b => (
              <div key={b.l} style={{ flex: 1, height: 60, background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: b.r, boxShadow: b.s, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--ink-3)' }}>{b.l}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid / Spacing */}
      <div className="label" style={{ marginTop: 40, marginBottom: 16 }}>Grid · Spacing</div>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          {[4,8,12,16,24,32,48].map(n => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: n, height: n, background: 'var(--accent)', borderRadius: 2 }} />
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{n}</span>
            </div>
          ))}
          <div style={{ flex: 1, textAlign: 'right', fontSize: 12, color: 'var(--ink-3)' }}>
            4-Punkt-Grid · Container max-w 1280 · Sidebar 232 · Content-Gutter 32
          </div>
        </div>
      </div>
    </div>
  );
};
window.PageDS = DS;
