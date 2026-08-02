/* global React, Icon, Pill, Btn, Conf, Logo, Frame, Topbar */
// KLAX — Extras: QR-Rechnung-Editor, Kreditkarten-Abrechnung, Zeiterfassung

const chfE = (n) => n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═════════════════════════ QR-RECHNUNG EDITOR ═════════════════════════
const PageQrBill = () => {
  const fields = [
    { l: 'Empfänger (Kreditor)', v: 'Weibel-Müller AG' },
    { l: 'IBAN', v: 'CH12 0070 0110 0012 3456 7', mono: true },
    { l: 'Strasse', v: 'Bahnhofstrasse 42' },
    { l: 'PLZ / Ort', v: '6003 Luzern' },
    { l: 'Land', v: 'CH' },
  ];
  const invoiceFields = [
    { l: 'Rechnungsnummer', v: 'R-2026-0142', mono: true },
    { l: 'Kunde', v: 'Keller Immobilien AG' },
    { l: 'Betrag CHF', v: '14 250.00', mono: true },
    { l: 'Referenz (QR-Ref)', v: '21 00000 00003 13947 14300 09017', mono: true },
    { l: 'Zahlbar bis', v: '15.05.2026' },
    { l: 'Zusätzliche Informationen', v: 'Honorar Beratung Q1/2026 · Projekt Atlas' },
  ];

  return (
    <Frame active="rechnungen" height={1100}>
      <Topbar
        title="QR-Rechnung erstellen"
        subtitle="Schweizer QR-Rechnung (ISO 20022) · mit Zahlschein-Vorschau"
        breadcrumbs={['Rechnungen', 'QR-Rechnung']}
        actions={<>
          <Btn icon="eye">Vorschau</Btn>
          <Btn icon="download">PDF herunterladen</Btn>
          <Btn variant="primary" icon="arrow">Senden & verbuchen</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: 28 }}>

          {/* Left: Form */}
          <div>
            {/* Empfänger */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 14 }}>Empfänger (Ihre Firma)</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {fields.map(f => (
                  <div key={f.l}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{f.l}</div>
                    <div style={{
                      padding: '9px 12px', border: '1px solid var(--hair)', borderRadius: 8,
                      background: 'var(--surface-2)', fontSize: 13,
                      fontFamily: f.mono ? 'var(--font-mono)' : 'inherit',
                    }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rechnung */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 14 }}>Rechnungsdaten</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {invoiceFields.map(f => (
                  <div key={f.l}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{f.l}</div>
                    <div style={{
                      padding: '9px 12px', border: '1px solid var(--hair)', borderRadius: 8,
                      background: 'var(--surface)', fontSize: 13,
                      fontFamily: f.mono ? 'var(--font-mono)' : 'inherit',
                    }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Kunde wählen */}
            <div className="card card--soft" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon name="users" size={16} style={{ color: 'var(--ink-3)' }} />
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Kunde aus Stammdaten laden</span>
              <div style={{ flex: 1 }} />
              <Btn size="sm">Kunden wählen</Btn>
            </div>
          </div>

          {/* Right: QR-Bill preview */}
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Vorschau Zahlschein</div>
            <div className="card" style={{
              padding: 0, overflow: 'hidden',
              boxShadow: 'var(--shadow-2)',
            }}>
              {/* Invoice header area */}
              <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--hair)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Weibel-Müller AG</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Bahnhofstrasse 42 · 6003 Luzern</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>CHE-123.456.789 MWST</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Rechnung</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>R-2026-0142</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Datum: 15.04.2026</div>
                  </div>
                </div>
              </div>

              {/* Invoice body */}
              <div style={{ padding: '20px 32px' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>Rechnungsadresse</div>
                  <div style={{ fontSize: 13 }}>Keller Immobilien AG</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Seestrasse 18 · 6004 Luzern</div>
                </div>

                <div style={{ height: 1, background: 'var(--hair)', margin: '16px 0' }} />

                {[
                  ['Beratung Q1/2026 · Projekt Atlas · 48h × CHF 280', '13 440.00'],
                  ['Spesen (Reise, Material)', '810.00'],
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, borderBottom: '1px solid var(--hair)' }}>
                    <span>{r[0]}</span>
                    <span className="mono">{r[1]}</span>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12 }}>
                  <span>MWST 8.1%</span><span className="mono">1 154.25</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, fontSize: 15, borderTop: '2px solid var(--ink)' }}>
                  <span>Total CHF</span><span className="mono">14 250.00</span>
                </div>
              </div>

              {/* QR payment part */}
              <div style={{
                borderTop: '1px dashed var(--ink-3)',
                padding: '20px 32px',
                background: 'var(--surface-2)',
                display: 'grid', gridTemplateColumns: '1fr 140px', gap: 20,
              }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10, fontWeight: 600 }}>Zahlteil</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10.5 }}>
                    {[
                      ['Konto / Zahlbar an', 'CH12 0070 0110 0012 3456 7\nWeibel-Müller AG\nBahnhofstrasse 42\n6003 Luzern'],
                      ['Referenz', '21 00000 00003 13947\n14300 09017'],
                      ['Zahlbar durch', 'Keller Immobilien AG\nSeestrasse 18\n6004 Luzern'],
                      ['Währung  Betrag', 'CHF  14 250.00'],
                    ].map(([l, v], i) => (
                      <div key={i}>
                        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                        <div style={{ whiteSpace: 'pre-line', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{
                  width: 130, height: 130,
                  background: 'white', border: '1px solid var(--hair)',
                  borderRadius: 4, padding: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* QR code placeholder */}
                  <div style={{
                    width: 110, height: 110,
                    background: 'repeating-conic-gradient(var(--ink) 0% 25%, white 0% 50%) 0 0 / 10px 10px',
                    borderRadius: 2,
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                      width: 24, height: 24, background: 'white', borderRadius: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 16, height: 16, background: 'var(--ink)', borderRadius: 1 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI hint */}
            <div style={{
              display: 'flex', gap: 10, padding: 12, marginTop: 12,
              background: 'var(--ai-soft)', border: '1px solid var(--ai-line)',
              borderRadius: 8, fontSize: 12
            }}>
              <Icon name="sparkle" size={14} style={{ color: 'var(--ai)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ color: 'var(--ink-2)' }}>
                KLAX generiert den QR-Code mit Swiss QR Code Standard und validiert IBAN + Referenz automatisch.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
};

// ═════════════════════════ KREDITKARTEN-ABRECHNUNG ═════════════════════════
const PageCreditCard = () => {
  const txns = [
    { date: '18.04.2026', vendor: 'Coop Pronto Oerlikon', cat: '6580 Repräsentation', amt: 16.40, mwst: '2.6%', conf: 72, warn: 'Bewirtung — Kunde angeben?', status: 'suggested' },
    { date: '17.04.2026', vendor: 'Migros Luzern', cat: '6570 Büromaterial', amt: 64.20, mwst: '8.1%', conf: 84, status: 'suggested' },
    { date: '15.04.2026', vendor: 'Shell Tankstelle A2', cat: '6200 Fahrzeugaufwand', amt: 92.40, mwst: '8.1%', conf: 96, status: 'approved' },
    { date: '14.04.2026', vendor: 'Booking.com Amsterdam', cat: '6640 Reisespesen', amt: 248.00, mwst: 'Bezug Ausland', conf: 89, status: 'approved' },
    { date: '12.04.2026', vendor: 'SBB Mobile', cat: '6640 Reisespesen', amt: 54.80, mwst: '8.1%', conf: 98, status: 'approved' },
    { date: '10.04.2026', vendor: 'Amazon EU', cat: '6570 Büromaterial', amt: 129.90, mwst: 'Bezug Ausland', conf: 91, status: 'approved' },
    { date: '08.04.2026', vendor: 'Uber Zürich', cat: '6640 Reisespesen', amt: 24.50, mwst: '8.1%', conf: 95, status: 'approved' },
    { date: '05.04.2026', vendor: 'Adobe Creative Cloud', cat: '6560 Software', amt: 74.35, mwst: 'Bezug Ausland', conf: 99, status: 'approved' },
    { date: '03.04.2026', vendor: 'Wolt Food Delivery', cat: '6580 Repräsentation', amt: 38.90, mwst: '2.6%', conf: 68, warn: 'Privat oder Geschäft?', status: 'suggested' },
    { date: '01.04.2026', vendor: 'Google Workspace', cat: '6560 Software', amt: 84.00, mwst: 'Bezug Ausland', conf: 99, status: 'approved' },
  ];
  const total = txns.reduce((s, t) => s + t.amt, 0);
  const pending = txns.filter(t => t.status === 'suggested').length;

  return (
    <Frame active="bank-konten" height={1150}>
      <Topbar
        title="Kreditkarten-Abrechnung"
        subtitle="ZKB Visa Business · April 2026 · 10 Transaktionen"
        breadcrumbs={['Bank & Zahlungen', 'Konten & Karten', 'ZKB Visa']}
        actions={<>
          <Btn icon="upload">CSV importieren</Btn>
          <Btn variant="primary" icon="check">Alle freigeben ({pending})</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>

        {/* Card summary */}
        <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', gap: 28, alignItems: 'center' }}>
          <div style={{
            width: 220, height: 138, borderRadius: 14,
            background: 'linear-gradient(145deg, #1A1917 0%, #3E3B36 100%)',
            padding: '18px 22px', color: '#E8E4DA',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: '0 8px 24px -8px rgba(0,0,0,.3)',
            flexShrink: 0, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .7 }}>ZKB Visa Business</div>
            <div className="mono" style={{ fontSize: 14, letterSpacing: '0.15em' }}>•••• •••• •••• 4821</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ fontSize: 10, opacity: .6 }}>R. Müller · 08/28</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em' }}>VISA</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <div className="label">Abrechnung April</div>
              <div className="num display" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{chfE(total)}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{txns.length} Transaktionen</div>
            </div>
            <div>
              <div className="label">Kontiert</div>
              <div className="num display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--pos)', marginTop: 4 }}>{txns.length - pending}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>automatisch von KLAX</div>
            </div>
            <div>
              <div className="label">Zu prüfen</div>
              <div className="num display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--warn)', marginTop: 4 }}>{pending}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Confidence &lt; 80%</div>
            </div>
            <div>
              <div className="label">Kreditlimit</div>
              <div className="num display" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>10 000</div>
              <div style={{ height: 4, background: 'var(--hair)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(total/10000)*100}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Transaction table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="k-table">
            <thead><tr>
              <th>Datum</th>
              <th>Händler</th>
              <th>Konto</th>
              <th>MWST</th>
              <th style={{ width: 100 }}>KI</th>
              <th style={{ textAlign: 'right' }}>CHF</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr></thead>
            <tbody>
              {txns.map((t, i) => (
                <tr key={i} style={{ background: t.warn ? 'color-mix(in oklab, var(--warn-soft) 40%, transparent)' : undefined }}>
                  <td className="mono" style={{ fontSize: 12 }}>{t.date}</td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.vendor}</div>
                    {t.warn && (
                      <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Icon name="warn" size={11} />{t.warn}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{t.cat}</td>
                  <td className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t.mwst}</td>
                  <td><Conf value={t.conf} /></td>
                  <td className="amt" style={{ textAlign: 'right', fontWeight: 500 }}>−{chfE(t.amt)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {t.status === 'suggested' ? <Pill variant="warn">prüfen</Pill> : <Pill variant="pos" icon="check">ok</Pill>}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-2)', fontWeight: 600 }}>
                <td colSpan={5}>Total April 2026</td>
                <td className="amt" style={{ textAlign: 'right', fontSize: 14 }}>−{chfE(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Frame>
  );
};

// ═════════════════════════ ZEITERFASSUNG ═════════════════════════
const PageTimeTracking = () => {
  const days = [
    { d: 'Mo 21.04.', entries: [
      { proj: 'Projekt Atlas', task: 'Konzept & Offerte', h: 4.5, rate: 280 },
      { proj: 'WM Intern', task: 'Buchhaltung / Admin', h: 2.0, rate: 0 },
      { proj: 'Keller Immobilien', task: 'Beratung vor Ort', h: 1.5, rate: 280 },
    ]},
    { d: 'Di 22.04.', entries: [
      { proj: 'Projekt Atlas', task: 'Entwurf Phase 2', h: 6.0, rate: 280 },
      { proj: 'WM Intern', task: 'Teamsitzung', h: 1.0, rate: 0 },
    ]},
    { d: 'Mi 23.04.', entries: [
      { proj: 'Waldmann AG', task: 'Workshop Kick-Off', h: 3.0, rate: 260 },
      { proj: 'Waldmann AG', task: 'Protokoll & Follow-up', h: 1.5, rate: 260 },
      { proj: 'Projekt Atlas', task: 'Revisionen Entwurf', h: 3.0, rate: 280 },
    ]},
  ];

  const totalH = days.reduce((s, d) => s + d.entries.reduce((ss, e) => ss + e.h, 0), 0);
  const billableH = days.reduce((s, d) => s + d.entries.filter(e => e.rate > 0).reduce((ss, e) => ss + e.h, 0), 0);
  const revenue = days.reduce((s, d) => s + d.entries.reduce((ss, e) => ss + e.h * e.rate, 0), 0);

  return (
    <Frame active="timetracking" height={1100}>
      <Topbar
        title="Zeiterfassung"
        subtitle="KW 17 · 21.–25. April 2026 · Rolf Müller"
        actions={<>
          <Btn icon="download">Rapport exportieren</Btn>
          <Btn variant="primary" icon="plus">Zeit erfassen</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="label">Total Stunden</div>
            <div className="num display" style={{ fontSize: 28, fontWeight: 500, marginTop: 4 }}>{totalH.toFixed(1)}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>h</span></div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>von 40h Soll</div>
            <div style={{ height: 4, background: 'var(--hair)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(totalH/40)*100}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div className="label">Verrechenbar</div>
            <div className="num display" style={{ fontSize: 28, fontWeight: 500, color: 'var(--pos)', marginTop: 4 }}>{billableH.toFixed(1)}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>h</span></div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{((billableH/totalH)*100).toFixed(0)}% Auslastung</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div className="label">Umsatz KW 17</div>
            <div className="num display" style={{ fontSize: 28, fontWeight: 500, marginTop: 4 }}>{chfE(revenue)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Ø CHF {chfE(revenue / billableH)}/h</div>
          </div>
          <div className="card" style={{ padding: 16, background: 'var(--accent-soft)', borderColor: 'var(--accent-line)' }}>
            <div className="label" style={{ color: 'var(--accent)' }}>Monat April</div>
            <div className="num display" style={{ fontSize: 28, fontWeight: 500, color: 'var(--accent)', marginTop: 4 }}>142.5<span style={{ fontSize: 14 }}>h</span></div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>von 168h Soll · CHF 34 840</div>
          </div>
        </div>

        {/* Week view */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--hair)', width: 'fit-content', marginBottom: 20 }}>
          {['KW 15', 'KW 16', 'KW 17', 'KW 18'].map((w, i) => (
            <div key={w} style={{
              padding: '6px 16px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
              background: i === 2 ? 'var(--surface)' : 'transparent',
              color: i === 2 ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: i === 2 ? 600 : 400,
              boxShadow: i === 2 ? 'var(--shadow-1)' : 'none',
              border: i === 2 ? '1px solid var(--hair)' : '1px solid transparent',
            }}>{w}</div>
          ))}
        </div>

        {/* Day-by-day entries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {days.map((day, di) => {
            const dayTotal = day.entries.reduce((s, e) => s + e.h, 0);
            const dayRev = day.entries.reduce((s, e) => s + e.h * e.rate, 0);
            return (
              <div key={di} className="card" style={{ overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '12px 20px', background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--hair)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{day.d}</div>
                  <div style={{ flex: 1 }} />
                  <div className="num" style={{ fontSize: 13 }}>{dayTotal}h</div>
                  <div style={{ width: 1, height: 16, background: 'var(--hair)' }} />
                  <div className="num" style={{ fontSize: 13, color: dayRev > 0 ? 'var(--pos)' : 'var(--ink-3)' }}>
                    {dayRev > 0 ? `CHF ${chfE(dayRev)}` : '—'}
                  </div>
                </div>
                <table className="k-table">
                  <tbody>
                    {day.entries.map((e, ei) => (
                      <tr key={ei}>
                        <td style={{ width: 200 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{e.proj}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{e.task}</div>
                        </td>
                        <td style={{ width: 80 }}>
                          <div className="num" style={{ fontSize: 14, fontWeight: 500 }}>{e.h}h</div>
                        </td>
                        <td style={{ width: 100 }}>
                          {e.rate > 0 ? (
                            <Pill variant="pos">CHF {e.rate}/h</Pill>
                          ) : (
                            <Pill>intern</Pill>
                          )}
                        </td>
                        <td className="num" style={{ textAlign: 'right', fontWeight: 500, color: e.rate > 0 ? 'var(--pos)' : 'var(--ink-3)' }}>
                          {e.rate > 0 ? chfE(e.h * e.rate) : '—'}
                        </td>
                        <td style={{ width: 60, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <Icon name="settings" size={13} style={{ color: 'var(--ink-4)' }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Remaining days placeholder */}
          {['Do 24.04.', 'Fr 25.04.'].map(d => (
            <div key={d} className="card card--soft" style={{
              padding: '20px 20px', display: 'flex', alignItems: 'center', gap: 16,
              borderStyle: 'dashed',
            }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-3)' }}>{d}</div>
              <div style={{ flex: 1, color: 'var(--ink-4)', fontSize: 12 }}>Noch keine Einträge</div>
              <Btn size="sm" icon="plus" variant="ghost">Erfassen</Btn>
            </div>
          ))}
        </div>

        {/* AI hint */}
        <div style={{
          display: 'flex', gap: 10, padding: 14, marginTop: 20,
          background: 'var(--ai-soft)', border: '1px solid var(--ai-line)',
          borderRadius: 10, fontSize: 12.5
        }}>
          <Icon name="sparkle" size={14} style={{ color: 'var(--ai)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, color: 'var(--ink-2)' }}>
            <span style={{ fontWeight: 500 }}>KLAX kann Zeiteinträge automatisch aus Kalender-Events vorschlagen</span> — aktiviere die Google/Outlook-Integration in den Einstellungen.
          </div>
        </div>
      </div>
    </Frame>
  );
};

Object.assign(window, { PageQrBill, PageCreditCard, PageTimeTracking });
