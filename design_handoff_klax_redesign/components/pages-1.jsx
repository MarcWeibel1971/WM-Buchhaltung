/* global React, Icon, Pill, Btn, Conf, Logo, Frame, Topbar, CopilotDock */
// KLAX page mockups — Dashboard, Inbox, Belege, Bank, Freigaben, Rechnungen, Berichte, MWST, Login/Onboarding

const SectionLabel = ({ children, icon, accent }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: accent ? 'var(--ai)' : 'var(--ink-3)', fontWeight: 500,
    marginBottom: 12,
  }}>
    {icon && <Icon name={icon} size={12} />}
    {children}
  </div>
);

// ────────────────── DASHBOARD ──────────────────
const PageDashboard = () => (
  <Frame active="dashboard">
    <Topbar
      title="Guten Morgen, Roger."
      subtitle="Weibel-Müller AG · Geschäftsjahr 2026 · KW 17"
      actions={<>
        <Btn icon="upload">Beleg hochladen</Btn>
        <Btn variant="primary" icon="plus">Rechnung erstellen</Btn>
      </>}
    />
    <div style={{ padding: '24px 32px', overflow: 'auto' }}>

      {/* COPILOT / KI HERO */}
      <div className="card" style={{
        padding: 22, marginBottom: 28,
        background: 'linear-gradient(180deg, #FBFAF7 0%, #F6F2EB 100%)',
        border: '1px solid var(--hair)',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'var(--ai-soft)', color: 'var(--ai)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid var(--ai-line)'
          }}>
            <Icon name="sparkle" size={17} stroke={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--ai)', fontWeight: 500 }}>KLAX HAT FÜR DICH VORBEREITET</span>
              <span className="pill pill--ai">Haiku 4.5</span>
            </div>
            <div className="display" style={{ fontSize: 20, letterSpacing: '-0.02em', fontWeight: 500, color: 'var(--ink)', marginBottom: 10, maxWidth: 720 }}>
              Seit Montag sind <u style={{ textDecorationColor: 'var(--ai)', textDecorationThickness: 2, textUnderlineOffset: 4 }}>14 neue Belege</u> eingetroffen. 11 habe ich kontiert, 9 davon mit Banktransaktionen gematcht.
              <span style={{ color: 'var(--ink-3)' }}> Du musst nur noch freigeben.</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="primary" size="sm" iconRight="arrow">12 Freigaben prüfen</Btn>
              <Btn size="sm">2 Belege mit Warnung</Btn>
              <Btn variant="ghost" size="sm" icon="bot">Was kannst du für mich tun?</Btn>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignSelf: 'center', color: 'var(--ink-2)', fontSize: 12 }}>
            {[
              { v: '89%', l: 'Automatisierung' },
              { v: '92%', l: 'Match-Quote' },
              { v: '1.2s', l: 'Ø Verarbeitung' },
            ].map(k => (
              <div key={k.l} style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontSize: 22, color: 'var(--ink)', fontWeight: 500 }}>{k.v}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HEUTE ZU ERLEDIGEN */}
      <SectionLabel>Heute zu erledigen</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { ic: 'file', c: 12, l: 'Zur Freigabe', sub: '8 mit KI-Vorschlag', t: 'accent' },
          { ic: 'bank', c: 3, l: 'Ungematchte Banktx', sub: 'ZKB Geschäftskonto', t: 'warn' },
          { ic: 'receipt', c: 4, l: 'Fällige Rechnungen', sub: 'insg. 14’380 CHF', t: 'neg' },
          { ic: 'warn', c: 2, l: 'Belege mit Warnung', sub: 'MWST unklar', t: 'info' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: `var(--${k.t === 'accent' ? 'accent-soft' : k.t + '-soft'})`,
                color: `var(--${k.t === 'accent' ? 'accent' : k.t})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={k.ic} size={15} />
              </div>
              <Icon name="arrow" size={14} style={{ color: 'var(--ink-4)' }} />
            </div>
            <div className="display" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.c}</div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{k.l}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FINANZSTATUS + ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* Finanzstatus */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div className="display" style={{ fontSize: 16, fontWeight: 500 }}>Finanzstatus</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>Q2 2026 · Stand heute</div>
            </div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 3, borderRadius: 8 }}>
              {['Monat', 'Quartal', 'Jahr'].map((t, i) => (
                <button key={t} style={{
                  padding: '4px 10px', fontSize: 11.5, border: 'none',
                  background: i === 1 ? 'var(--surface)' : 'transparent',
                  color: i === 1 ? 'var(--ink)' : 'var(--ink-3)',
                  borderRadius: 5, fontWeight: 500,
                  boxShadow: i === 1 ? 'var(--shadow-1)' : 'none',
                  cursor: 'pointer'
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 22 }}>
            {[
              { l: 'Liquidität', v: '284’520.40', d: '+CHF 12’400 vs. Vormonat', pos: true },
              { l: 'Offene Forderungen', v: '48’210.00', d: '7 Rechnungen · 3 überfällig' },
              { l: 'Ergebnis YTD', v: '+62’840.15', d: 'Marge 18.4%', pos: true },
            ].map(k => (
              <div key={k.l}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>{k.l}</div>
                <div className="num display" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: k.pos ? 'var(--pos)' : 'var(--ink)' }}>
                  CHF {k.v}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{k.d}</div>
              </div>
            ))}
          </div>

          {/* Mini chart — bar pairs (Ertrag/Aufwand) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 130, borderTop: '1px solid var(--hair)', paddingTop: 16 }}>
            {['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'].map((m, i) => {
              const rev = 40 + Math.abs(Math.sin(i*0.8))*55;
              const exp = 28 + Math.abs(Math.cos(i*0.9))*38;
              return (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }}>
                    <div style={{ width: 10, height: `${rev}%`, background: 'var(--accent)', borderRadius: 2 }} />
                    <div style={{ width: 10, height: `${exp}%`, background: 'var(--accent-line)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{m}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink-3)', marginTop: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: 2 }} /> Ertrag
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: 'var(--accent-line)', borderRadius: 2 }} /> Aufwand
            </span>
          </div>
        </div>

        {/* Activity feed */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="display" style={{ fontSize: 16, fontWeight: 500 }}>Aktivität</div>
            <Pill variant="ai" icon="sparkle">Live</Pill>
          </div>
          {[
            { t: 'Swisscom Rechnung erkannt', d: 'CHF 142.90 · 6510 Telefon · 94% conf.', time: 'vor 3 Min', ai: true },
            { t: 'Banktx gematcht: Coop', d: 'mit Beleg #2024-041', time: 'vor 8 Min', ai: true },
            { t: 'Rechnung R-0097 bezahlt', d: 'Kundin Hofer Architekten', time: 'vor 1 Std', pos: true },
            { t: 'Freigabe durch Roger M.', d: '8 Buchungen · CHF 4’280', time: 'vor 2 Std' },
            { t: 'KI-Regel aktualisiert', d: 'Google Workspace → 6540', time: 'gestern' },
            { t: 'MWST Q1/2026 eingereicht', d: 'via ESTV SuisseTax', time: '21. Apr' },
          ].map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, padding: '10px 0',
              borderBottom: i < 5 ? '1px solid var(--hair)' : 'none'
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: a.ai ? 'var(--ai-soft)' : a.pos ? 'var(--pos-soft)' : 'var(--surface-2)',
                color: a.ai ? 'var(--ai)' : a.pos ? 'var(--pos)' : 'var(--ink-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon name={a.ai ? 'sparkle' : a.pos ? 'check' : 'dot'} size={11} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{a.t}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{a.d}</div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{a.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <CopilotDock />
  </Frame>
);

// ────────────────── INBOX ──────────────────
const PageInbox = () => (
  <Frame active="inbox">
    <Topbar
      title="Inbox"
      subtitle="19 offene Aufgaben · Klax hat 11 automatisch erledigt"
      actions={<>
        <Btn icon="upload" size="sm">Beleg hochladen</Btn>
        <Btn variant="primary" icon="check" size="sm">Alles freigeben (12)</Btn>
      </>}
    />
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '100%', minHeight: 0 }}>
      {/* Filter rail */}
      <div style={{ borderRight: '1px solid var(--hair)', padding: '20px 16px', overflow: 'auto' }}>
        <SectionLabel>Stapel</SectionLabel>
        {[
          { n: 'Zur Freigabe', c: 12, ic: 'check', active: true },
          { n: 'Ungematcht', c: 3, ic: 'link' },
          { n: 'Mit Warnung', c: 2, ic: 'warn' },
          { n: 'Fällig (Zahlung)', c: 4, ic: 'clock' },
          { n: 'Entwürfe', c: 5, ic: 'file' },
        ].map(s => (
          <div key={s.n} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8,
            background: s.active ? 'var(--accent-soft)' : 'transparent',
            color: s.active ? 'var(--accent)' : 'var(--ink-2)', fontSize: 13,
            fontWeight: s.active ? 500 : 400, marginBottom: 2,
          }}>
            <Icon name={s.ic} size={14} />
            <span style={{ flex: 1 }}>{s.n}</span>
            <span className="num" style={{ fontSize: 11.5, color: s.active ? 'var(--accent)' : 'var(--ink-3)' }}>{s.c}</span>
          </div>
        ))}

        <SectionLabel accent icon="sparkle" >KI-Pipeline</SectionLabel>
        <div className="card card--soft" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 6 }}>Diese Woche</div>
          <div className="num display" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>47 / 53</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Belege automatisch kontiert</div>
          <div style={{ height: 3, background: 'var(--hair)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: '89%', height: '100%', background: 'var(--ai)' }} />
          </div>
        </div>

        <SectionLabel>Quellen</SectionLabel>
        {[
          { n: 'E-Mail (invoices@)', c: 8 },
          { n: 'Drag & Drop', c: 14 },
          { n: 'Kreditkarten-Sync', c: 23 },
          { n: 'Bank-API (ZKB)', c: 31 },
        ].map(s => (
          <div key={s.n} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            <span>{s.n}</span>
            <span className="num" style={{ color: 'var(--ink-4)' }}>{s.c}</span>
          </div>
        ))}
      </div>

      {/* Main list */}
      <div style={{ overflow: 'auto' }}>
        <div style={{ padding: '16px 32px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill variant="accent" icon="check">12 Zur Freigabe</Pill>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Gruppiert nach Lieferant</span>
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" size="sm" icon="filter">Filter</Btn>
          <Btn variant="ghost" size="sm">Sortieren: Confidence</Btn>
        </div>

        {/* Groups */}
        {[
          { vendor: 'Swisscom (Schweiz) AG', cat: '6510 Telekom-Gebühren', count: 3, total: '428.70', items: [
            { id: 'R-0142', d: 'Rechnung April', amt: '142.90', dat: '12.04.26', conf: 97 },
            { id: 'R-0141', d: 'Rechnung März', amt: '142.90', dat: '12.03.26', conf: 97 },
            { id: 'R-0140', d: 'Rechnung Februar', amt: '142.90', dat: '12.02.26', conf: 96 },
          ]},
          { vendor: 'Google Workspace', cat: '6540 IT-Dienstleistungen', count: 1, total: '84.00', items: [
            { id: 'INV-8834', d: 'Business Standard · 6 users', amt: '84.00', dat: '01.04.26', conf: 99 },
          ]},
          { vendor: 'Coop · diverse Belege', cat: '6570 Büromaterial', count: 4, total: '287.40', items: [
            { id: 'K-2031', d: 'Büromaterial', amt: '64.20', dat: '18.04.26', conf: 84, warn: true },
            { id: 'K-2030', d: 'Bewirtung Kundentermin', amt: '118.40', dat: '17.04.26', conf: 72, warn: true },
          ]},
        ].map((g, i) => (
          <div key={i} style={{ padding: '8px 24px' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Group header */}
              <div style={{
                padding: '12px 16px', background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid var(--hair)'
              }}>
                <Icon name="chevD" size={14} style={{ color: 'var(--ink-3)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.vendor}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{g.cat} · {g.count} Belege</div>
                </div>
                <span className="num" style={{ fontSize: 14, fontWeight: 500 }}>CHF {g.total}</span>
                <Btn size="sm" variant="primary">Gruppe freigeben</Btn>
              </div>
              {g.items.map((it, j) => (
                <div key={j} style={{
                  display: 'grid', gridTemplateColumns: '22px 80px 1fr 110px 120px 140px',
                  padding: '12px 16px', alignItems: 'center', gap: 12,
                  borderBottom: j < g.items.length - 1 ? '1px solid var(--hair)' : 'none'
                }}>
                  <div style={{
                    width: 14, height: 14, border: '1.5px solid var(--hair-strong)', borderRadius: 4
                  }} />
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{it.id}</span>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{it.d}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>PDF · Mail erhalten am {it.dat}</div>
                  </div>
                  <Conf value={it.conf} />
                  {it.warn
                    ? <Pill variant="warn" icon="warn">MWST prüfen</Pill>
                    : <Pill variant="ai" icon="sparkle">Auto kontiert</Pill>
                  }
                  <span className="num" style={{ fontSize: 13, textAlign: 'right' }}>CHF {it.amt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Empty-state preview after list */}
        <div style={{ padding: '24px 32px 40px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
          Ende der Freigabeliste. Klax hat in den letzten 24 h <b style={{ color: 'var(--ink)' }}>23 Belege</b> automatisch verbucht.
        </div>
      </div>
    </div>
  </Frame>
);

Object.assign(window, { PageDashboard, PageInbox, SectionLabel });
