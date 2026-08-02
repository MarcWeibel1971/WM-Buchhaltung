/* global React, Icon, Pill, Btn, Conf, Logo, Frame, Topbar */
// KLAX — Abschluss: YearEnd wizard, OpenPositions / Mahnwesen, Payroll

const chf = (n) => n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═════════════════════════ JAHRESABSCHLUSS ═════════════════════════
const PageYearEnd = () => {
  const steps = [
    { n: 1, label: 'Abschluss starten',           status: 'done' },
    { n: 2, label: 'Vorschläge generieren',        status: 'done' },
    { n: 3, label: 'Buchungen prüfen',              status: 'active' },
    { n: 4, label: 'Rückbuchungen & Saldovortrag', status: 'idle' },
    { n: 5, label: 'Abschluss finalisieren',        status: 'idle' },
  ];
  const groups = [
    { key: 'tp', label: 'Transitorische Passiven', sub: 'Rechnungen 2026 für Leistungen 2025', accent: 'warn', total: 18420.50, pending: 4, items: [
      { d: 'Stromrechnung EWZ Dezember', s: '6200 Strom/Wasser', h: '2300 Trans. Passiven', a: '386.20', st: 'suggested', ai: 'Leistung 12/2025, Rechnung 05.01.2026' },
      { d: 'Swisscom Abo Dezember', s: '6510 Kommunikation', h: '2300 Trans. Passiven', a: '284.50', st: 'suggested', ai: 'Rechnung 03.01.2026 für Monat 12/2025' },
      { d: 'Reinigung Q4', s: '6020 Reinigung', h: '2300 Trans. Passiven', a: '1240.00', st: 'approved', ai: 'Leistung Okt–Dez 2025' },
      { d: 'Versicherung AXA Restquartal', s: '6300 Versicherungen', h: '2300 Trans. Passiven', a: '2140.00', st: 'approved', ai: 'Prämie Q4 2025' },
      { d: 'Revisionshonorar 2025', s: '6770 Revision', h: '2300 Trans. Passiven', a: '2400.00', st: 'suggested', ai: 'Revision im Feb 2026 geplant' },
      { d: 'Ferienrückstellung 31.12.', s: '5820 Personalaufwand', h: '2300 Trans. Passiven', a: '11970.00', st: 'suggested', ai: '47 Resttage × Ø-Tagesansatz' },
    ]},
    { key: 'ta', label: 'Transitorische Aktiven', sub: 'Vorauszahlungen 2025 für Leistungen 2026', accent: 'info', total: 8950.00, pending: 1, items: [
      { d: 'Miete Januar 2026 (vorausbezahlt)', s: '1300 Trans. Aktiven', h: '6000 Raumaufwand', a: '4500.00', st: 'suggested', ai: 'Zahlung 28.12.2025 für Januar' },
      { d: 'Software-Lizenz 10/25–09/26', s: '1300 Trans. Aktiven', h: '6560 Software', a: '2880.00', st: 'approved', ai: '9 Monate auf 2026 abzugrenzen' },
      { d: 'SBB GA-Abo 2026', s: '1300 Trans. Aktiven', h: '5820 Spesen', a: '1570.00', st: 'approved', ai: 'Gültigkeit 01.01.–31.12.2026' },
    ]},
    { key: 'af', label: 'Abschreibungen Anlagen', sub: 'Planmässig linear', accent: 'accent', total: 11080.00, pending: 2, items: [
      { d: 'Mobiliar 10 Jahre linear', s: '6820 Abschreibungen', h: '1520 Wertber. Mobiliar', a: '4200.00', st: 'suggested', ai: 'Buchwert 42 000 · AfA 10%' },
      { d: 'EDV 4 Jahre linear', s: '6820 Abschreibungen', h: '1530 Wertber. EDV', a: '6880.00', st: 'suggested', ai: 'Buchwert 27 500 · AfA 25%' },
    ]},
    { key: 'kr', label: 'Offene Kreditoren', sub: 'Unbezahlt per Stichtag', accent: 'neg', total: 14280.30, pending: 0, items: [
      { d: 'Gerber Treuhand Honorar', s: '6770 Dienstleistungen', h: '2000 Verbindlichkeiten', a: '3800.00', st: 'approved', ai: 'Rechnung 12/2025, offen' },
      { d: 'Schindler Aufzüge Wartung', s: '6000 Raumaufwand', h: '2000 Verbindlichkeiten', a: '1290.00', st: 'approved', ai: 'Rechnung 12/2025, offen' },
      { d: 'Migros Facility 4. Quartal', s: '6020 Reinigung', h: '2000 Verbindlichkeiten', a: '9190.30', st: 'approved', ai: 'Sammelrechnung Okt–Dez' },
    ]},
  ];
  const [open, setOpen] = React.useState('tp');
  const pendingTotal = groups.reduce((s, g) => s + g.pending, 0);
  const approvedTotal = groups.reduce((s, g) => s + g.items.filter(i => i.st === 'approved').length, 0);
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

  return (
    <Frame active="abschluss" height={1400}>
      <Topbar
        title="Jahresabschluss GJ 2025"
        subtitle="5-Schritte-Wizard · KI-gestützte Jahresendbuchungen"
        actions={<>
          <Btn icon="arrow">GJ 2026 eröffnen</Btn>
          <Btn variant="primary" icon="check">{pendingTotal} Vorschläge prüfen</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { y: 2023, s: 'Abgeschlossen' }, { y: 2024, s: 'Abgeschlossen' },
            { y: 2025, s: 'Im Abschluss', active: true }, { y: 2026, s: 'Laufend' }
          ].map(f => (
            <div key={f.y} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 13,
              border: `1px solid ${f.active ? 'var(--accent)' : 'var(--hair)'}`,
              background: f.active ? 'var(--accent)' : 'var(--surface)',
              color: f.active ? 'var(--accent-ink)' : 'var(--ink)',
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}>
              <span style={{ fontWeight: 500 }}>GJ {f.y}</span>
              <span style={{ fontSize: 11, opacity: f.active ? 1 : .6 }}>{f.s}</span>
            </div>
          ))}
        </div>

        {/* Stepper */}
        <div className="card" style={{ padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {steps.map((st, i) => (
              <React.Fragment key={st.n}>
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', borderRadius: 10,
                  background: st.status === 'active' ? 'var(--accent-soft)' : st.status === 'done' ? 'var(--pos-soft)' : 'transparent',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 999,
                    background: st.status === 'done' ? 'var(--pos)' : st.status === 'active' ? 'var(--accent)' : 'var(--surface-2)',
                    color: st.status === 'idle' ? 'var(--ink-3)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12,
                  }}>
                    {st.status === 'done' ? <Icon name="check" size={14} stroke={2.4} /> : st.n}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: st.status === 'active' ? 'var(--accent)' : 'var(--ink-3)' }}>Schritt {st.n}</div>
                    <div style={{ fontSize: 12.5, fontWeight: st.status === 'active' ? 600 : 500, color: st.status === 'idle' ? 'var(--ink-3)' : 'var(--ink)' }}>{st.label}</div>
                  </div>
                </div>
                {i < steps.length - 1 && <Icon name="chevR" size={14} style={{ color: 'var(--ink-4)', margin: '0 4px' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Status', v: 'Im Abschluss', c: 'var(--warn)', sub: 'seit 08.01.2026' },
            { l: 'Offene Vorschläge', v: pendingTotal, c: 'var(--warn)', sub: 'von 15 gesamt' },
            { l: 'Genehmigt', v: approvedTotal, c: 'var(--pos)', sub: 'bereit zur Buchung' },
            { l: 'Buchungsvolumen', v: chf(grandTotal), c: 'var(--ink)', sub: 'CHF brutto', num: true },
          ].map((k, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div className="label">{k.l}</div>
              <div className={k.num ? 'num display' : ''} style={{ fontSize: 22, fontWeight: 500, color: k.c, marginTop: 4 }}>{k.v}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* AI callout */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 16px', marginBottom: 20, background: 'var(--ai-soft)', border: '1px solid var(--ai-line)', borderRadius: 10, fontSize: 12.5 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--ai)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="sparkle" size={14} stroke={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: 2 }}>15 Buchungsvorschläge aus Bank, Kreditoren und Anlagespiegel generiert</div>
            <div style={{ color: 'var(--ink-2)' }}>KLAX hat alle Belege, Vorauszahlungen und Abschreibungen analysiert — <span style={{ color: 'var(--ai)', textDecoration: 'underline' }}>Details</span></div>
          </div>
          <Pill variant="ai">Claude Haiku 4.5</Pill>
        </div>

        {/* Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(g => {
            const isOpen = open === g.key;
            const col = g.accent === 'warn' ? 'var(--warn)' : g.accent === 'info' ? 'var(--info)' : g.accent === 'neg' ? 'var(--neg)' : 'var(--accent)';
            return (
              <div key={g.key} className="card" style={{ overflow: 'hidden' }}>
                <div onClick={() => setOpen(isOpen ? null : g.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', cursor: 'pointer',
                  background: isOpen ? 'var(--surface-2)' : 'var(--surface)',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: `color-mix(in oklab, ${col} 14%, var(--surface))`, color: col,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={g.accent === 'warn' ? 'receipt' : g.accent === 'info' ? 'arrow' : g.accent === 'neg' ? 'file' : 'chart'} size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{g.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{g.sub} · {g.items.length} Buchungen</div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 12 }}>
                    <div className="num" style={{ fontSize: 15, fontWeight: 500 }}>{chf(g.total)}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>CHF</div>
                  </div>
                  {g.pending > 0 && <Pill variant="warn">{g.pending} offen</Pill>}
                  <Icon name="chevD" size={15} style={{ color: 'var(--ink-3)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', marginLeft: 10 }} />
                </div>
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--hair)' }}>
                    <table className="k-table">
                      <thead><tr>
                        <th>Beschreibung</th><th>Soll</th><th>Haben</th>
                        <th style={{ textAlign: 'right' }}>CHF</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ width: 70 }}></th>
                      </tr></thead>
                      <tbody>
                        {g.items.map((it, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.d}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                                <Icon name="sparkle" size={10} stroke={2} style={{ color: 'var(--ai)', marginTop: 2, flexShrink: 0 }} />{it.ai}
                              </div>
                            </td>
                            <td className="mono" style={{ fontSize: 11.5 }}>{it.s}</td>
                            <td className="mono" style={{ fontSize: 11.5 }}>{it.h}</td>
                            <td className="amt" style={{ textAlign: 'right', fontWeight: 500 }}>{it.a}</td>
                            <td style={{ textAlign: 'center' }}>
                              {it.st === 'suggested' ? <Pill variant="warn">Vorschlag</Pill> : <Pill variant="pos" icon="check">Genehmigt</Pill>}
                            </td>
                            <td>
                              {it.st === 'suggested' && (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  <button style={{ border: 0, background: 'var(--pos-soft)', color: 'var(--pos)', width: 24, height: 24, borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={12} stroke={2.4} /></button>
                                  <button style={{ border: 0, background: 'var(--neg-soft)', color: 'var(--neg)', width: 24, height: 24, borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={12} stroke={2.4} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
};

// ═════════════════════════ OFFENE POSTEN / MAHNWESEN ═════════════════════════
const PageOpenPositions = () => {
  const invoices = [
    { nr: 'R-2026-0028', cust: 'Keller Immobilien AG', city: 'Luzern', date: '15.01.2026', due: '14.02.2026', amt: 14250.00, days: 68, stage: 2, last: '20.03.2026' },
    { nr: 'R-2026-0041', cust: 'Baumann GmbH', city: 'Zürich', date: '28.01.2026', due: '27.02.2026', amt: 8900.00, days: 55, stage: 1, last: '05.04.2026' },
    { nr: 'R-2026-0052', cust: 'Sutter Gruppe AG', city: 'Bern', date: '08.02.2026', due: '10.03.2026', amt: 12500.00, days: 44, stage: 1, last: '15.04.2026' },
    { nr: 'R-2026-0063', cust: 'Lehmann & Partner', city: 'Basel', date: '14.02.2026', due: '16.03.2026', amt: 4820.00, days: 38, stage: 1, last: null },
    { nr: 'R-2026-0071', cust: 'Waldmann AG', city: 'Luzern', date: '22.02.2026', due: '24.03.2026', amt: 22400.00, days: 30, stage: 0, last: null },
    { nr: 'R-2026-0088', cust: 'Meier Metallbau', city: 'Aarau', date: '28.02.2026', due: '30.03.2026', amt: 6180.00, days: 24, stage: 0, last: null },
    { nr: 'R-2026-0094', cust: 'Schwarz Architektur', city: 'Zug', date: '05.03.2026', due: '04.04.2026', amt: 9840.00, days: 19, stage: 0, last: null },
    { nr: 'R-2026-0102', cust: 'Weber Transport', city: 'Winterthur', date: '12.03.2026', due: '11.04.2026', amt: 2940.00, days: 12, stage: 0, last: null },
    { nr: 'R-2026-0115', cust: 'Immo Holding AG', city: 'Zürich', date: '18.03.2026', due: '17.04.2026', amt: 18200.00, days: 6, stage: 'prev', last: null },
    { nr: 'R-2026-0124', cust: 'Gastro Service GmbH', city: 'Luzern', date: '25.03.2026', due: '24.04.2026', amt: 3640.00, days: -1, stage: 'nodue', last: null },
    { nr: 'R-2026-0136', cust: 'Böhler Schreinerei', city: 'Thun', date: '02.04.2026', due: '02.05.2026', amt: 5840.00, days: -9, stage: 'nodue', last: null },
  ];
  const overdue = invoices.filter(i => i.days > 0);
  const totalOpen = invoices.reduce((s, i) => s + i.amt, 0);
  const totalOverdue = overdue.reduce((s, i) => s + i.amt, 0);

  const stageLabel = (s, d) => {
    if (s === 0) return { txt: 'Zahlungserinnerung fällig', v: 'warn' };
    if (s === 1) return { txt: '1. Mahnung versandt', v: 'warn' };
    if (s === 2) return { txt: '2. Mahnung versandt', v: 'neg' };
    if (s === 3) return { txt: 'Inkasso', v: 'neg' };
    if (s === 'prev') return { txt: 'Prävention', v: 'info' };
    return { txt: 'nicht fällig', v: 'default' };
  };

  return (
    <Frame active="offene-posten" height={1250}>
      <Topbar
        title="Offene Posten"
        subtitle="Debitoren · 3-stufiges Mahnwesen mit präventivem Early-Reminder"
        actions={<>
          <Btn icon="download">Exportieren</Btn>
          <Btn variant="primary" icon="sparkle">Mahnlauf starten (7)</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="label">Offene Forderungen</div>
            <div className="num display" style={{ fontSize: 24, fontWeight: 500, marginTop: 4 }}>{chf(totalOpen)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{invoices.length} Rechnungen</div>
          </div>
          <div className="card" style={{ padding: 16, borderColor: 'color-mix(in oklab, var(--neg) 25%, var(--hair))' }}>
            <div className="label" style={{ color: 'var(--neg)' }}>Überfällig</div>
            <div className="num display" style={{ fontSize: 24, fontWeight: 500, color: 'var(--neg)', marginTop: 4 }}>{chf(totalOverdue)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{overdue.length} Rechnungen</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div className="label">Durchschn. Zahlungsziel</div>
            <div className="num display" style={{ fontSize: 24, fontWeight: 500, marginTop: 4 }}>32<span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 400 }}> Tage</span></div>
            <div style={{ fontSize: 11, color: 'var(--pos)', marginTop: 4 }}>↓ 4 Tage vs. Q4/2025</div>
          </div>
          <div className="card" style={{ padding: 16, background: 'var(--ai-soft)', borderColor: 'var(--ai-line)' }}>
            <div className="label" style={{ color: 'var(--ai)' }}>KLAX-Prognose</div>
            <div className="num display" style={{ fontSize: 24, fontWeight: 500, marginTop: 4 }}>{chf(42840)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Zahlungseingang nächste 7 Tage</div>
          </div>
        </div>

        {/* Aging chart */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Altersstruktur</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Offene Forderungen nach Überfälligkeit</div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink-3)' }}>
              {[{ l: 'nicht fällig', c: 'var(--surface-2)' }, { l: '1–30 T', c: 'var(--warn-soft)' }, { l: '31–60 T', c: 'var(--warn)' }, { l: '> 60 T', c: 'var(--neg)' }].map(l => (
                <div key={l.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.c }} />{l.l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, height: 120 }}>
            {[
              { v: 9480, h: 40, c: 'var(--surface-2)', ink: 'var(--ink)' },
              { v: 24200, h: 72, c: 'var(--warn-soft)', ink: 'var(--warn)' },
              { v: 26220, h: 78, c: 'var(--warn)', ink: '#fff' },
              { v: 14250, h: 48, c: 'var(--neg)', ink: '#fff' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                <div className="num" style={{ fontSize: 12, fontWeight: 500 }}>{chf(b.v)}</div>
                <div style={{ width: '100%', height: `${b.h}%`, background: b.c, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6, color: b.ink, fontSize: 10, fontWeight: 500 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Alle offenen Rechnungen</div>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{invoices.length} Einträge</span>
            <div style={{ flex: 1 }} />
            <Pill variant="warn" icon="sparkle">7 Mahnungen vorgeschlagen</Pill>
          </div>
          <table className="k-table">
            <thead><tr>
              <th style={{ width: 120 }}>Rechnung</th>
              <th>Kunde</th>
              <th>Datum</th>
              <th>Fällig</th>
              <th style={{ textAlign: 'right' }}>Betrag CHF</th>
              <th style={{ textAlign: 'center' }}>Überfällig</th>
              <th>Mahnstufe</th>
              <th style={{ width: 80 }}></th>
            </tr></thead>
            <tbody>
              {invoices.map(inv => {
                const lbl = stageLabel(inv.stage, inv.days);
                const isOverdue = inv.days > 0;
                return (
                  <tr key={inv.nr} style={{ background: isOverdue ? 'color-mix(in oklab, var(--neg-soft) 30%, transparent)' : undefined }}>
                    <td className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{inv.nr}</td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{inv.cust}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{inv.city}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{inv.date}</td>
                    <td className="mono" style={{ fontSize: 12, color: isOverdue ? 'var(--neg)' : 'var(--ink)', fontWeight: isOverdue ? 600 : 400 }}>{inv.due}</td>
                    <td className="amt" style={{ textAlign: 'right', fontWeight: 500 }}>{chf(inv.amt)}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: isOverdue ? 'var(--neg)' : inv.stage === 'prev' ? 'var(--info)' : 'var(--ink-3)', fontWeight: isOverdue ? 600 : 400 }}>
                      {isOverdue ? `+${inv.days} T` : inv.days < 0 ? `${inv.days} T` : '0 T'}
                    </td>
                    <td>
                      <Pill variant={lbl.v}>{lbl.txt}</Pill>
                      {inv.last && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>zuletzt {inv.last}</div>}
                    </td>
                    <td>
                      {inv.stage === 0 ? (
                        <Btn size="sm" variant="primary">Mahnen</Btn>
                      ) : inv.stage === 1 || inv.stage === 2 ? (
                        <Btn size="sm">Eskalieren</Btn>
                      ) : inv.stage === 'prev' ? (
                        <Btn size="sm" variant="ghost" icon="sparkle">Erinnern</Btn>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Frame>
  );
};

// ═════════════════════════ PAYROLL ═════════════════════════
const PagePayroll = () => {
  const employees = [
    { name: 'Rolf Müller', role: 'Geschäftsleiter', ahv: '756.1234.5678.90', brutto: 12000, bvg: 840, ahv_p: 651, alv: 132, ktg: 36, unfall: 42, netto: 10299, status: 'ok' },
    { name: 'Sabine Weibel', role: 'Treuhand Senior', ahv: '756.2345.6789.01', brutto: 9800, bvg: 686, ahv_p: 532, alv: 108, ktg: 29, unfall: 34, netto: 8411, status: 'ok' },
    { name: 'Mario Keller', role: 'Buchhalter', ahv: '756.3456.7890.12', brutto: 7200, bvg: 504, ahv_p: 391, alv: 79, ktg: 22, unfall: 25, netto: 6179, status: 'ok' },
    { name: 'Lisa Baumann', role: 'Assistenz', ahv: '756.4567.8901.23', brutto: 6200, bvg: 434, ahv_p: 336, alv: 68, ktg: 19, unfall: 22, netto: 5321, status: 'ok' },
    { name: 'Pavel Novak', role: 'Revisor', ahv: '756.5678.9012.34', brutto: 10500, bvg: 735, ahv_p: 570, alv: 116, ktg: 31, unfall: 37, netto: 9011, status: 'warn', note: 'Quellensteuer: CH-Tarif A0 neu' },
  ];
  const tot = {
    brutto: employees.reduce((s, e) => s + e.brutto, 0),
    bvg: employees.reduce((s, e) => s + e.bvg, 0),
    ahv: employees.reduce((s, e) => s + e.ahv_p, 0),
    alv: employees.reduce((s, e) => s + e.alv, 0),
    ktg: employees.reduce((s, e) => s + e.ktg, 0),
    unfall: employees.reduce((s, e) => s + e.unfall, 0),
    netto: employees.reduce((s, e) => s + e.netto, 0),
  };

  return (
    <Frame active="payroll" height={1350}>
      <Topbar
        breadcrumbs={['Personalwesen', 'Lohnläufe']}
        title="Lohnlauf April 2026"
        subtitle="5 Mitarbeitende · AHV/ALV/BVG/KTG/UVG · Lohnausweise CH"
        actions={<>
          <Btn icon="download">Lohnausweise</Btn>
          <Btn icon="download">pain.001</Btn>
          <Btn variant="primary" icon="check">Lohnlauf bestätigen</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>
        {/* Month tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--hair)', width: 'fit-content', marginBottom: 20 }}>
          {['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'].map((m, i) => (
            <div key={m} style={{
              padding: '6px 14px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
              background: i === 3 ? 'var(--surface)' : 'transparent',
              color: i === 3 ? 'var(--ink)' : i <= 2 ? 'var(--ink-2)' : 'var(--ink-4)',
              fontWeight: i === 3 ? 600 : 400,
              boxShadow: i === 3 ? 'var(--shadow-1)' : 'none',
              border: i === 3 ? '1px solid var(--hair)' : '1px solid transparent',
            }}>
              {m}
              {i <= 2 && <span style={{ marginLeft: 6, color: 'var(--pos)' }}>✓</span>}
            </div>
          ))}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Bruttolohn', v: chf(tot.brutto), c: 'var(--ink)' },
            { l: 'Arbeitnehmerbeiträge', v: chf(tot.ahv + tot.alv + tot.ktg), c: 'var(--neg)' },
            { l: 'BVG (Pensionskasse)', v: chf(tot.bvg), c: 'var(--neg)' },
            { l: 'UVG (Unfall)', v: chf(tot.unfall), c: 'var(--neg)' },
            { l: 'Nettoauszahlung', v: chf(tot.netto), c: 'var(--pos)', big: true },
          ].map((k, i) => (
            <div key={i} className="card" style={{ padding: 16, background: k.big ? 'var(--pos-soft)' : 'var(--surface)', borderColor: k.big ? 'color-mix(in oklab, var(--pos) 25%, var(--hair))' : 'var(--hair)' }}>
              <div className="label" style={{ color: k.big ? 'var(--pos)' : undefined }}>{k.l}</div>
              <div className="num display" style={{ fontSize: k.big ? 22 : 18, fontWeight: 500, color: k.c, marginTop: 4 }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>CHF · April 2026</div>
            </div>
          ))}
        </div>

        {/* Rates info bar */}
        <div className="card" style={{ padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, background: 'var(--surface-2)' }}>
          <Icon name="percent" size={16} style={{ color: 'var(--ink-3)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>Sozialversicherungssätze 2026</span>
          <div style={{ flex: 1 }} />
          {[
            { l: 'AHV/IV/EO', v: '5.425%' }, { l: 'ALV', v: '1.1%' }, { l: 'BVG Ø', v: '7.0%' },
            { l: 'KTG (AG)', v: '0.3%' }, { l: 'NBU (AN)', v: '0.35%' }, { l: 'Familienzulagen AG', v: '1.5%' },
          ].map(r => (
            <div key={r.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{r.v}</span>
              <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>{r.l}</span>
            </div>
          ))}
        </div>

        {/* Employees table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="k-table">
            <thead><tr>
              <th>Mitarbeiter:in</th>
              <th>AHV-Nr.</th>
              <th style={{ textAlign: 'right' }}>Brutto</th>
              <th style={{ textAlign: 'right' }}>AHV/IV/EO</th>
              <th style={{ textAlign: 'right' }}>ALV</th>
              <th style={{ textAlign: 'right' }}>KTG</th>
              <th style={{ textAlign: 'right' }}>BVG</th>
              <th style={{ textAlign: 'right' }}>UVG</th>
              <th style={{ textAlign: 'right' }}>Netto CHF</th>
              <th style={{ width: 80 }}></th>
            </tr></thead>
            <tbody>
              {employees.map((e, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{e.role}</div>
                    {e.note && (
                      <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 3, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Icon name="warn" size={11} />{e.note}
                      </div>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>{e.ahv}</td>
                  <td className="amt" style={{ textAlign: 'right', fontWeight: 500 }}>{chf(e.brutto)}</td>
                  <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(e.ahv_p)}</td>
                  <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(e.alv)}</td>
                  <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(e.ktg)}</td>
                  <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(e.bvg)}</td>
                  <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(e.unfall)}</td>
                  <td className="amt amt-pos" style={{ textAlign: 'right', fontWeight: 600 }}>{chf(e.netto)}</td>
                  <td>
                    {e.status === 'warn' ? <Pill variant="warn">prüfen</Pill> : <Pill variant="pos" icon="check">ok</Pill>}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-2)', fontWeight: 600, borderTop: '2px solid var(--ink-3)' }}>
                <td colSpan={2}>Total · {employees.length} Mitarbeitende</td>
                <td className="amt" style={{ textAlign: 'right' }}>{chf(tot.brutto)}</td>
                <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(tot.ahv)}</td>
                <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(tot.alv)}</td>
                <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(tot.ktg)}</td>
                <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(tot.bvg)}</td>
                <td className="amt amt-neg" style={{ textAlign: 'right' }}>− {chf(tot.unfall)}</td>
                <td className="amt amt-pos display" style={{ textAlign: 'right', fontSize: 14 }}>{chf(tot.netto)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Year-end hint */}
        <div style={{ display: 'flex', gap: 12, padding: 14, marginTop: 20, background: 'var(--ai-soft)', border: '1px solid var(--ai-line)', borderRadius: 10, fontSize: 12.5 }}>
          <Icon name="sparkle" size={16} style={{ color: 'var(--ai)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: 2 }}>Jahreslohnausweise automatisch generieren</div>
            <div style={{ color: 'var(--ink-2)' }}>KLAX bereitet am 31.12. alle Lohnausweise (Formular 11) und ESTV-Meldungen vor — mit QR-Code und elektronischem Versand an die Mitarbeitenden.</div>
          </div>
          <Btn size="sm" variant="ghost">Vorschau</Btn>
        </div>
      </div>
    </Frame>
  );
};

Object.assign(window, { PageYearEnd, PageOpenPositions, PagePayroll });
