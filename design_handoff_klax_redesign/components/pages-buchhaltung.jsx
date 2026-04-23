/* global React, Icon, Pill, Btn, Conf, Logo, Frame, Topbar */
// KLAX page mockups — Buchhaltung: Kreditoren, Kontenplan, Kontendetail, Global Rules, Settings

const BH_SectionLabel = ({ children, icon, accent }) => (
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

// ────────────────── KREDITOREN (ISO 20022 pain.001) ──────────────────
const PageKreditoren = () => {
  const rows = [
    { sel: true, n: 'Swisscom (Schweiz) AG', f: 'R-2026-0412.pdf', iban: 'CH93 0076 2011 6238 5295 7', city: '3050 Bern, CH', doc: '14.04.2026', due: '28.04.2026', amt: '284.50', ref: 'RF18 5390 0754 3225 1', status: 'offen' },
    { sel: true, n: 'AXA Versicherungen', f: 'Praemie Q2-2026.pdf', iban: 'CH56 0483 5012 3456 7800 0', city: '8008 Zürich, CH', doc: '12.04.2026', due: '30.04.2026', amt: '2 140.00', ref: 'RF81 1234 5678 9012 3', status: 'offen' },
    { sel: true, n: 'Heitzmann GmbH', f: 'Büromaterial 04-26.pdf', iban: 'CH47 0076 2011 6238 5295 0', city: '6003 Luzern, CH', doc: '09.04.2026', due: '23.04.2026', amt: '412.85', ref: 'RF92 0001 2345 6789', status: 'überfällig' },
    { sel: true, n: 'Elektrizitätswerk ZH', f: 'Stromrechnung März.pdf', iban: 'CH19 0070 0110 0055 6611 0', city: '8010 Zürich, CH', doc: '05.04.2026', due: '19.04.2026', amt: '386.20', ref: 'RF42 9876 5432 1098', status: 'überfällig' },
    { sel: true, n: 'Schindler Aufzüge AG', f: 'Wartungsvertrag.pdf', iban: 'CH58 0023 0230 1234 5678 9', city: '6030 Ebikon, CH', doc: '02.04.2026', due: '02.05.2026', amt: '1 290.00', ref: 'RF55 4444 5555 6666', status: 'offen' },
    { sel: false, n: 'Gerber Treuhand', f: 'Honorarabrechnung.pdf', iban: '', city: '—', doc: '01.04.2026', due: '15.05.2026', amt: '3 800.00', ref: '', status: 'IBAN fehlt' },
    { sel: true, n: 'SBB Cargo', f: 'Transport 03-2026.pdf', iban: 'CH36 0900 0000 3000 0180 0', city: '3000 Bern, CH', doc: '28.03.2026', due: '27.04.2026', amt: '642.30', ref: 'RF77 1010 2020 3030', status: 'offen' },
    { sel: true, n: 'Migros Luzern', f: 'Verpflegung.pdf', iban: 'CH74 0839 0011 1111 2222 1', city: '6003 Luzern, CH', doc: '26.03.2026', due: '25.04.2026', amt: '148.40', ref: '', status: 'offen' },
    { sel: true, n: 'Post CH AG', f: 'Porto April.pdf', iban: 'CH09 0900 0000 8550 6105 4', city: '3030 Bern, CH', doc: '24.03.2026', due: '23.04.2026', amt: '89.90', ref: 'RF11 1122 2233 3344', status: 'offen' },
  ];
  const selected = rows.filter(r => r.sel);
  const total = selected.reduce((s, r) => s + parseFloat(r.amt.replace(/[^\d.]/g, '')), 0);

  return (
    <Frame active="kreditoren">
      <Topbar
        title="Kreditorenzahlungen"
        subtitle="9 offene Eingangsrechnungen · ISO 20022 pain.001 exportieren"
        actions={<>
          <Btn icon="upload">CAMT.054 importieren</Btn>
          <Btn variant="primary" icon="download">pain.001 exportieren</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>

        {/* Settings bar */}
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div className="label" style={{ marginBottom: 6 }}>Belastungskonto</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                border: '1px solid var(--hair)', borderRadius: 8, background: 'var(--surface)',
                fontSize: 13,
              }}>
                <Icon name="bank" size={15} />
                <span style={{ fontWeight: 500 }}>ZKB Geschäftskonto</span>
                <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 12 }}>CH12 0070 0110 0012 3456 7</span>
                <Icon name="chevD" size={13} style={{ marginLeft: 'auto', color: 'var(--ink-3)' }} />
              </div>
            </div>
            <div style={{ width: 180 }}>
              <div className="label" style={{ marginBottom: 6 }}>Ausführungsdatum</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                border: '1px solid var(--hair)', borderRadius: 8, background: 'var(--surface)',
                fontSize: 13,
              }}>
                <Icon name="calendar" size={14} />
                <span>23.04.2026</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Pill variant="pos" icon="check">18 bezahlt</Pill>
              <Pill variant="neg" icon="warn">9 offen</Pill>
              <Pill variant="warn" icon="clock">2 überfällig</Pill>
            </div>
          </div>
        </div>

        {/* KI-Hinweis */}
        <div style={{
          display: 'flex', gap: 12, padding: '12px 16px', marginBottom: 20,
          background: 'var(--ai-soft)', border: '1px solid var(--ai-line)',
          borderRadius: 10, alignItems: 'center', fontSize: 12.5, color: 'var(--ink-2)'
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: 'var(--ai)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Icon name="sparkle" size={13} stroke={2} />
          </div>
          <span>
            KLAX hat <strong>8 Rechnungen automatisch selektiert</strong> und das Ausführungsdatum auf das früheste Fälligkeitsdatum gesetzt.
            Bei 1 Rechnung fehlt die IBAN — <span style={{ color: 'var(--ai)', textDecoration: 'underline', textDecorationThickness: 1, cursor: 'pointer' }}>jetzt ergänzen</span>.
          </span>
          <span className="pill pill--ai" style={{ marginLeft: 'auto' }}>Auto-Auswahl</span>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <div style={{ width: 14, height: 14, border: '1.5px solid var(--ink-3)', borderRadius: 3, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={10} stroke={2.2} style={{ color: 'var(--accent-ink)' }} />
                  </div>
                </th>
                <th>Kreditor</th>
                <th>IBAN</th>
                <th>Ort / Land</th>
                <th>Datum</th>
                <th>Fällig</th>
                <th style={{ textAlign: 'right' }}>Betrag CHF</th>
                <th>QR-Referenz</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const overdue = r.status === 'überfällig';
                const noIban = !r.iban;
                return (
                  <tr key={i} style={{
                    background: r.sel ? 'color-mix(in oklab, var(--accent-soft) 40%, transparent)' : undefined,
                    opacity: noIban ? 0.6 : 1,
                  }}>
                    <td>
                      <div style={{
                        width: 14, height: 14, borderRadius: 3,
                        border: `1.5px solid ${r.sel ? 'var(--accent)' : 'var(--hair-strong)'}`,
                        background: r.sel ? 'var(--accent)' : 'var(--surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {r.sel && <Icon name="check" size={10} stroke={2.4} style={{ color: 'var(--accent-ink)' }} />}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{r.n}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.f}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {r.iban || <span style={{ color: 'var(--neg)', fontStyle: 'italic' }}>fehlt</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.city}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.doc}</td>
                    <td className="mono" style={{ fontSize: 12, color: overdue ? 'var(--neg)' : 'var(--ink)', fontWeight: overdue ? 600 : 400 }}>
                      {r.due}{overdue && <div style={{ fontSize: 10, fontWeight: 400 }}>überfällig</div>}
                    </td>
                    <td className="amt" style={{ textAlign: 'right', fontWeight: 500 }}>{r.amt}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.ref || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {r.status === 'überfällig' ? <Pill variant="warn">überfällig</Pill>
                        : r.status === 'IBAN fehlt' ? <Pill variant="neg">IBAN fehlt</Pill>
                        : <Pill>offen</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            <strong style={{ color: 'var(--ink)' }}>{selected.length}</strong> von <strong>9</strong> offenen Rechnungen ausgewählt
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="label">Total Zahlungsauftrag</div>
              <div className="num display" style={{ fontSize: 24, fontWeight: 500 }}>
                CHF {total.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <Btn variant="primary" icon="download">pain.001 erstellen</Btn>
          </div>
        </div>
      </div>
    </Frame>
  );
};

// ────────────────── KONTENPLAN ──────────────────
const PageKontenplan = () => {
  const groups = [
    { type: 'Aktiven', ink: 'pos', accs: [
      { n: '1000', l: 'Kasse', bal: '1 285.50' },
      { n: '1020', l: 'ZKB Geschäftskonto', bal: '84 312.85' },
      { n: '1025', l: 'UBS Fremdwährung USD', bal: '12 445.20' },
      { n: '1100', l: 'Forderungen aus L&L', bal: '42 180.00' },
      { n: '1170', l: 'Vorsteuer 8.1%', bal: '3 840.65' },
      { n: '1200', l: 'Warenvorräte', bal: '28 600.00' },
      { n: '1510', l: 'Mobiliar & Einrichtung', bal: '18 000.00' },
      { n: '1520', l: 'Büromaschinen, IT', bal: '12 400.00' },
    ]},
    { type: 'Passiven', ink: 'neg', accs: [
      { n: '2000', l: 'Verbindlichkeiten aus L&L', bal: '21 450.85' },
      { n: '2100', l: 'Kurzfristige Verbindlichkeiten', bal: '5 200.00' },
      { n: '2200', l: 'Umsatzsteuer 8.1%', bal: '8 124.40' },
      { n: '2600', l: 'Rückstellungen', bal: '12 000.00' },
    ]},
    { type: 'Eigenkapital', ink: 'info', accs: [
      { n: '2800', l: 'Aktienkapital', bal: '100 000.00' },
      { n: '2970', l: 'Gewinnvortrag', bal: '45 820.30' },
    ]},
    { type: 'Ertrag', ink: 'pos', accs: [
      { n: '3000', l: 'Dienstleistungserträge', bal: '284 120.50' },
      { n: '3200', l: 'Warenverkauf', bal: '52 680.00' },
      { n: '3400', l: 'Übriger betrieblicher Ertrag', bal: '2 140.00' },
    ]},
    { type: 'Aufwand', ink: 'warn', accs: [
      { n: '4000', l: 'Warenaufwand', bal: '38 420.00' },
      { n: '5000', l: 'Personalaufwand', bal: '142 800.00' },
      { n: '6000', l: 'Raumaufwand', bal: '18 600.00' },
      { n: '6300', l: 'Versicherungen', bal: '4 280.00' },
      { n: '6500', l: 'Verwaltungs- und Informatikaufwand', bal: '8 240.40' },
      { n: '6800', l: 'Abschreibungen', bal: '6 200.00' },
    ]},
  ];

  return (
    <Frame active="kontenplan">
      <Topbar
        title="Kontenplan"
        subtitle="42 Konten · KMU-Kontenrahmen · GJ 2026"
        actions={<>
          <Btn icon="search">Suchen</Btn>
          <Btn icon="download">Exportieren</Btn>
          <Btn variant="primary" icon="plus">Konto anlegen</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>

        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { l: 'Aktiven', v: '203 083.20', n: 8, c: 'var(--pos)' },
            { l: 'Passiven', v: '46 775.25', n: 4, c: 'var(--neg)' },
            { l: 'Eigenkapital', v: '145 820.30', n: 2, c: 'var(--info)' },
            { l: 'Ertrag', v: '338 940.50', n: 3, c: 'var(--pos)' },
            { l: 'Aufwand', v: '218 540.40', n: 6, c: 'var(--warn)' },
          ].map(k => (
            <div key={k.l} className="card" style={{ padding: 16 }}>
              <div className="label" style={{ color: k.c }}>{k.l}</div>
              <div className="num display" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{k.v}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{k.n} Konten</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{
            flex: 1, maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', border: '1px solid var(--hair)', borderRadius: 8,
            background: 'var(--surface)', fontSize: 13
          }}>
            <Icon name="search" size={14} style={{ color: 'var(--ink-3)' }} />
            <span style={{ color: 'var(--ink-4)' }}>Konto suchen (Nr. oder Name)…</span>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--hair)' }}>
            {['Alle', 'Aktiven', 'Passiven', 'Eigenkapital', 'Ertrag', 'Aufwand'].map((t, i) => (
              <button key={t} style={{
                padding: '5px 10px', fontSize: 12, fontFamily: 'inherit',
                background: i === 0 ? 'var(--surface)' : 'transparent',
                color: i === 0 ? 'var(--ink)' : 'var(--ink-3)',
                border: i === 0 ? '1px solid var(--hair)' : '1px solid transparent',
                borderRadius: 4, cursor: 'pointer', fontWeight: i === 0 ? 500 : 400,
                boxShadow: i === 0 ? 'var(--shadow-1)' : 'none',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Groups */}
        {groups.map(g => (
          <div key={g.type} className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 16px', background: 'var(--surface-2)',
              borderBottom: '1px solid var(--hair)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 3, height: 14, background: `var(--${g.ink})`, borderRadius: 2 }} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>{g.type}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{g.accs.length} Konten</span>
            </div>
            <table className="k-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Nr.</th>
                  <th>Bezeichnung</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Saldo CHF</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {g.accs.map(a => (
                  <tr key={a.n} style={{ cursor: 'pointer' }}>
                    <td className="mono" style={{ fontWeight: 500, fontSize: 13 }}>{a.n}</td>
                    <td style={{ fontSize: 13 }}>{a.l}</td>
                    <td className="amt" style={{ textAlign: 'right' }}>{a.bal}</td>
                    <td><Icon name="chevR" size={14} style={{ color: 'var(--ink-4)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      </div>
    </Frame>
  );
};

// ────────────────── KONTENDETAIL (Ledger) ──────────────────
const PageKontendetail = () => {
  const lines = [
    { d: '01.01.2026', t: 'Eröffnungssaldo', nr: '—', soll: '', haben: '', saldo: '82 140.00', opening: true },
    { d: '04.01.2026', t: 'Zahlungseingang Rechnung R-2025-1284 Muster AG', nr: '2026-0012', soll: '12 480.00', haben: '', saldo: '94 620.00' },
    { d: '08.01.2026', t: 'Überweisung Swisscom Rechnung Q4-2025', nr: '2026-0018', soll: '', haben: '284.50', saldo: '94 335.50' },
    { d: '12.01.2026', t: 'Bar-Entnahme Geschäftskasse', nr: '2026-0024', soll: '', haben: '500.00', saldo: '93 835.50' },
    { d: '15.01.2026', t: 'Zahlungseingang Sammeldebitor Q1', nr: '2026-0031', soll: '8 240.00', haben: '', saldo: '102 075.50' },
    { d: '22.01.2026', t: 'AXA Prämie Q1-2026 Sachversicherung (3-Jahres-Paket, Rate 14/36)', nr: '2026-0042', soll: '', haben: '2 140.00', saldo: '99 935.50' },
    { d: '28.01.2026', t: 'EWZ Stromrechnung Dezember', nr: '2026-0048', soll: '', haben: '412.85', saldo: '99 522.65' },
    { d: '05.02.2026', t: 'Rechnungseingang Migros Verpflegung', nr: '2026-0052', soll: '', haben: '148.40', saldo: '99 374.25' },
    { d: '12.02.2026', t: 'Umsatz Handelsgeschäft 2026-001', nr: '2026-0061', soll: '4 820.00', haben: '', saldo: '104 194.25' },
    { d: '18.02.2026', t: 'Gerber Treuhand Honorar 2025', nr: '2026-0072', soll: '', haben: '3 800.00', saldo: '100 394.25' },
    { d: '23.02.2026', t: 'Ausgangsrechnung R-2026-0042 Keller & Co bezahlt', nr: '2026-0081', soll: '14 250.00', haben: '', saldo: '114 644.25' },
  ];

  return (
    <Frame active="kontendetail">
      <Topbar
        breadcrumbs={['Kontenplan', '1020 · ZKB Geschäftskonto']}
        title="1020 – ZKB Geschäftskonto"
        subtitle="Aktiven · Geschäftsjahr 2026 · 142 Buchungen"
        actions={<>
          <Btn icon="filter">Filter</Btn>
          <Btn icon="pdf">Drucken</Btn>
          <Btn icon="download">CSV</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="label">Eröffnungssaldo</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>82 140.00</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div className="label" style={{ color: 'var(--pos)' }}>Total Soll</div>
            <div className="num amt-pos" style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>+ 39 790.00</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div className="label" style={{ color: 'var(--neg)' }}>Total Haben</div>
            <div className="num amt-neg" style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>− 7 285.75</div>
          </div>
          <div className="card" style={{ padding: 16, background: 'var(--accent-soft)', borderColor: 'var(--accent-line)' }}>
            <div className="label" style={{ color: 'var(--accent)' }}>Schlusssaldo</div>
            <div className="num display" style={{ fontSize: 24, fontWeight: 500, marginTop: 4, color: 'var(--accent)' }}>114 644.25</div>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{
            flex: 1, maxWidth: 320, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', border: '1px solid var(--hair)', borderRadius: 8,
            background: 'var(--surface)', fontSize: 13
          }}>
            <Icon name="search" size={14} style={{ color: 'var(--ink-3)' }} />
            <span style={{ color: 'var(--ink-4)' }}>Buchungstext suchen…</span>
          </div>
          <Pill icon="calendar">01.01.2026 – 23.04.2026</Pill>
          <Pill>Nur Soll</Pill>
          <Pill>Nur Haben</Pill>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>
            11 von 142 Buchungen
          </div>
        </div>

        {/* Ledger */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Datum</th>
                <th>Buchungstext</th>
                <th style={{ width: 110 }}>Beleg-Nr.</th>
                <th style={{ textAlign: 'right', width: 130 }}>Soll CHF</th>
                <th style={{ textAlign: 'right', width: 130 }}>Haben CHF</th>
                <th style={{ textAlign: 'right', width: 140 }}>Saldo CHF</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} style={{
                  background: l.opening ? 'var(--surface-2)' : undefined,
                  fontStyle: l.opening ? 'italic' : 'normal',
                }}>
                  <td className="mono" style={{ fontSize: 12 }}>{l.d}</td>
                  <td style={{ fontSize: 13 }}>{l.t}</td>
                  <td className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{l.nr}</td>
                  <td className="amt amt-pos" style={{ textAlign: 'right' }}>{l.soll}</td>
                  <td className="amt amt-neg" style={{ textAlign: 'right' }}>{l.haben}</td>
                  <td className="amt" style={{ textAlign: 'right', fontWeight: l.opening ? 500 : 400 }}>{l.saldo}</td>
                  <td><Icon name="chevR" size={13} style={{ color: 'var(--ink-4)' }} /></td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-2)', fontWeight: 600, borderTop: '2px solid var(--ink-3)' }}>
                <td></td>
                <td>Schlusssaldo</td>
                <td></td>
                <td className="amt amt-pos" style={{ textAlign: 'right' }}>39 790.00</td>
                <td className="amt amt-neg" style={{ textAlign: 'right' }}>7 285.75</td>
                <td className="amt display" style={{ textAlign: 'right', fontSize: 15 }}>114 644.25</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Frame>
  );
};

// ────────────────── GLOBAL RULES (Admin KI-Regeln) ──────────────────
const PageGlobalRules = () => {
  const rules = [
    { p: 'Swisscom*', d: 'Mobilabo, Festnetz', tmpl: 'Telefonkosten Swisscom', soll: '6500', haben: '1020', cat: 'Telekommunikation', vat: '8.1', prio: 10, src: 'manual', uses: 142, active: true },
    { p: 'AXA Versicherungen*', d: 'Prämie, Sach', tmpl: 'Versicherungsprämie AXA', soll: '6300', haben: '2000', cat: 'Versicherungen (Sach)', vat: '—', prio: 15, src: 'manual', uses: 36, active: true },
    { p: 'SBB*', d: 'Fahrkarte, GA', tmpl: 'Reisespesen SBB', soll: '6300', haben: '1020', cat: 'Reisekosten', vat: '8.1', prio: 5, src: 'ai', uses: 87, active: true },
    { p: 'Migros, Coop, Denner', d: 'Verpflegung', tmpl: 'Verpflegung Team', soll: '6540', haben: '1020', cat: 'Bewirtung', vat: '2.6', prio: 5, src: 'ai', uses: 54, active: true },
    { p: 'EWZ, Stadtwerke, BKW', d: 'Strom', tmpl: 'Energiekosten', soll: '6000', haben: '2000', cat: 'Energie / Strom', vat: '8.1', prio: 8, src: 'manual', uses: 24, active: true },
    { p: 'Gerber Treuhand AG', d: 'Honorar', tmpl: 'Treuhand-Honorar', soll: '6770', haben: '2000', cat: 'Beratung / Honorare', vat: '8.1', prio: 20, src: 'manual', uses: 12, active: true },
    { p: 'Post CH*', d: 'Porto, Paket', tmpl: 'Portokosten', soll: '6500', haben: '1020', cat: 'Porto / Versand', vat: '—', prio: 5, src: 'ai', uses: 118, active: true },
    { p: 'ZKB, UBS, Raiffeisen', d: 'Kontoführung, Gebühren', tmpl: 'Bankspesen', soll: '6940', haben: '1020', cat: 'Bankgebühren', vat: '—', prio: 12, src: 'manual', uses: 94, active: true },
    { p: 'Apple, Microsoft, Adobe', d: 'Lizenz, Abo', tmpl: 'Software-Abo', soll: '6500', haben: '2000', cat: 'IT / Software', vat: '8.1', prio: 8, src: 'ai', uses: 42, active: true },
    { p: 'Schindler Aufzüge', d: 'Wartung', tmpl: 'Unterhalt Gebäude', soll: '6100', haben: '2000', cat: 'Unterhalt / Reparaturen', vat: '8.1', prio: 5, src: 'manual', uses: 8, active: false },
  ];
  const stats = [
    { v: 94, l: 'Regeln gesamt', c: 'var(--ink)' },
    { v: 82, l: 'Aktiv', c: 'var(--pos)' },
    { v: 12, l: 'Inaktiv', c: 'var(--ink-3)' },
    { v: 41, l: 'Manuell', c: 'var(--info)' },
    { v: 53, l: 'KI-gelernt', c: 'var(--ai)' },
    { v: '1 284', l: 'Anwendungen', c: 'var(--warn)' },
  ];

  return (
    <Frame active="rules">
      <Topbar
        breadcrumbs={['Admin', 'KI-Regeln']}
        title="Globale KI-Regeln"
        subtitle="Allgemeine Verbuchungsregeln für alle Mandanten · Kundenspezifische Regeln haben Vorrang"
        actions={<>
          <Btn icon="download">Exportieren</Btn>
          <Btn variant="primary" icon="plus">Neue Regel</Btn>
        </>}
      />
      <div style={{ padding: '24px 32px', overflow: 'auto' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
          {stats.map(s => (
            <div key={s.l} className="card" style={{ padding: 14 }}>
              <div className="num display" style={{ fontSize: 22, fontWeight: 500, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Info card — 3-Ebenen-System */}
        <div className="card" style={{ padding: 18, marginBottom: 20, background: 'var(--surface-2)', borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: 'var(--ai-soft)',
              color: 'var(--ai)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--ai-line)', flexShrink: 0
            }}>
              <Icon name="sparkle" size={14} stroke={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Drei-Ebenen-Kontierung</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { n: 1, t: 'Kundenspezifisch', d: 'Individuelle Korrekturen eines Mandanten — immer Vorrang.', c: 'var(--accent)' },
                  { n: 2, t: 'Global (hier)', d: 'KMU-weite Muster als Fallback. Speichert Kontonummern, nicht IDs.', c: 'var(--ai)' },
                  { n: 3, t: 'LLM-Vorschlag', d: 'Wenn nichts matcht, fragt Klax die KI nach einem Vorschlag.', c: 'var(--ink-3)' },
                ].map(step => (
                  <div key={step.n} style={{
                    padding: 12, borderRadius: 8, background: 'var(--surface)',
                    border: '1px solid var(--hair)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 999, background: step.c, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-display)'
                      }}>{step.n}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{step.t}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{step.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <div style={{
            flex: 1, maxWidth: 320, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', border: '1px solid var(--hair)', borderRadius: 8,
            background: 'var(--surface)', fontSize: 13
          }}>
            <Icon name="search" size={14} style={{ color: 'var(--ink-3)' }} />
            <span style={{ color: 'var(--ink-4)' }}>Gegenpartei oder Buchungstext suchen…</span>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--hair)' }}>
            {['Alle Quellen', 'Manuell', 'KI-gelernt'].map((t, i) => (
              <button key={t} style={{
                padding: '5px 10px', fontSize: 12, fontFamily: 'inherit',
                background: i === 0 ? 'var(--surface)' : 'transparent',
                color: i === 0 ? 'var(--ink)' : 'var(--ink-3)',
                border: i === 0 ? '1px solid var(--hair)' : '1px solid transparent',
                borderRadius: 4, cursor: 'pointer', fontWeight: i === 0 ? 500 : 400,
              }}>{t}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>
            Sortiert nach <span style={{ color: 'var(--ink)', fontWeight: 500 }}>Priorität ↓</span>
          </div>
        </div>

        {/* Rules table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Aktiv</th>
                <th>Gegenpartei-Muster</th>
                <th>Buchungstext</th>
                <th style={{ width: 80 }}>Soll</th>
                <th style={{ width: 80 }}>Haben</th>
                <th>Kategorie</th>
                <th style={{ width: 70 }}>MWST</th>
                <th style={{ width: 60 }}>Prio</th>
                <th style={{ width: 100 }}>Quelle</th>
                <th style={{ width: 90, textAlign: 'right' }}>Nutzung</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={i} style={{ opacity: r.active ? 1 : 0.5 }}>
                  <td>
                    <div style={{
                      width: 28, height: 16, borderRadius: 999,
                      background: r.active ? 'var(--accent)' : 'var(--hair-strong)',
                      position: 'relative', cursor: 'pointer',
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: r.active ? 14 : 2,
                        width: 12, height: 12, borderRadius: 999, background: '#fff',
                        boxShadow: '0 1px 2px rgba(0,0,0,.15)', transition: 'left .15s',
                      }} />
                    </div>
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>
                    <span className="mono" style={{ fontSize: 12 }}>{r.p}</span>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.d}</div>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{r.tmpl}</td>
                  <td><span className="pill mono">{r.soll}</span></td>
                  <td><span className="pill mono">{r.haben}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.cat}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.vat !== '—' ? `${r.vat}%` : '—'}</td>
                  <td><span className="pill" style={{ fontFamily: 'var(--font-mono)' }}>{r.prio}</span></td>
                  <td>
                    {r.src === 'ai'
                      ? <Pill variant="ai" icon="sparkle">KI</Pill>
                      : <Pill variant="info">Manuell</Pill>}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{r.uses}×</td>
                  <td><Icon name="settings" size={13} style={{ color: 'var(--ink-4)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Frame>
  );
};

// ────────────────── SETTINGS ──────────────────
const PageSettings = () => {
  const sections = [
    { n: 'Firma', active: true },
    { n: 'Team & Rollen' },
    { n: 'Geschäftsjahre' },
    { n: 'Bankverbindungen' },
    { n: 'MWST-Einstellungen' },
    { n: 'Kontenplan' },
    { n: 'KI-Einstellungen' },
    { n: 'Integrationen' },
    { n: 'Import / Export' },
    { n: 'Abrechnung' },
  ];

  return (
    <Frame active="settings">
      <Topbar
        title="Einstellungen"
        subtitle="Weibel-Müller AG"
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sub-nav */}
        <div style={{
          width: 220, borderRight: '1px solid var(--hair)',
          padding: '20px 12px', flexShrink: 0,
        }}>
          {sections.map(s => (
            <div key={s.n} style={{
              padding: '8px 12px', fontSize: 13, borderRadius: 6, marginBottom: 2,
              background: s.active ? 'var(--surface-2)' : 'transparent',
              color: s.active ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: s.active ? 500 : 400, cursor: 'pointer',
              borderLeft: s.active ? '2px solid var(--accent)' : '2px solid transparent',
            }}>{s.n}</div>
          ))}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, padding: '28px 36px', overflow: 'auto' }}>
          <div style={{ maxWidth: 680 }}>

            {/* Company identity */}
            <div style={{ marginBottom: 36 }}>
              <h2 className="display" style={{ fontSize: 18, fontWeight: 500, margin: 0, marginBottom: 4 }}>
                Firmen-Identität
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, marginBottom: 20 }}>
                Erscheint auf Rechnungen, Mahnungen und Exporten.
              </p>

              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
                <div style={{
                  width: 96, height: 96, borderRadius: 14,
                  background: 'var(--surface-2)', border: '1px dashed var(--hair-strong)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-3)', fontSize: 11, gap: 4,
                }}>
                  <Icon name="upload" size={18} />
                  Logo
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>Weibel-Müller AG</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Handelsgesellschaft · UID CHE-123.456.789</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Btn size="sm" icon="upload">Logo hochladen</Btn>
                    <Btn size="sm" variant="ghost">PDF-Briefpapier</Btn>
                  </div>
                </div>
              </div>

              {/* Form fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { l: 'Firmenname', v: 'Weibel-Müller AG' },
                  { l: 'UID-Nummer', v: 'CHE-123.456.789', mono: true },
                  { l: 'MWST-Nummer', v: 'CHE-123.456.789 MWST', mono: true },
                  { l: 'Rechtsform', v: 'Aktiengesellschaft', select: true },
                  { l: 'Strasse', v: 'Bahnhofstrasse 42', span: 2 },
                  { l: 'PLZ', v: '6003' },
                  { l: 'Ort', v: 'Luzern' },
                  { l: 'Land', v: 'Schweiz', select: true },
                  { l: 'Telefon', v: '+41 41 123 45 67', mono: true },
                  { l: 'E-Mail', v: 'info@weibel-mueller.ch', mono: true, span: 2 },
                  { l: 'Website', v: 'www.weibel-mueller.ch', span: 2 },
                ].map((f, i) => (
                  <div key={i} style={{ gridColumn: f.span === 2 ? 'span 2' : undefined }}>
                    <label className="label" style={{ display: 'block', marginBottom: 4 }}>{f.l}</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px', border: '1px solid var(--hair)', borderRadius: 8,
                      background: 'var(--surface)', fontSize: 13,
                      fontFamily: f.mono ? 'var(--font-mono)' : 'inherit',
                    }}>
                      <span style={{ flex: 1 }}>{f.v}</span>
                      {f.select && <Icon name="chevD" size={13} style={{ color: 'var(--ink-3)' }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fiscal year */}
            <div style={{ marginBottom: 36 }}>
              <h2 className="display" style={{ fontSize: 18, fontWeight: 500, margin: 0, marginBottom: 4 }}>
                Geschäftsjahr
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, marginBottom: 16 }}>
                Aktuelles Jahr und Zeitraum.
              </p>
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="display" style={{ fontSize: 24, fontWeight: 500 }}>Geschäftsjahr 2026</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>01.01.2026 – 31.12.2026 · Tag 113 von 365</div>
                  </div>
                  <Pill variant="pos" icon="check">Offen</Pill>
                </div>
                <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 999, marginTop: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '31%', background: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <Btn size="sm">Vorjahr wechseln</Btn>
                  <Btn size="sm" variant="ghost">Neues GJ anlegen</Btn>
                </div>
              </div>
            </div>

            {/* Currency / locale */}
            <div>
              <h2 className="display" style={{ fontSize: 18, fontWeight: 500, margin: 0, marginBottom: 4 }}>
                Regionales
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, marginBottom: 16 }}>
                Währung, Sprache und Zahlenformat.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {[
                  { l: 'Leitwährung', v: 'CHF · Schweizer Franken' },
                  { l: 'Sprache', v: 'Deutsch (CH)' },
                  { l: 'Datumsformat', v: 'TT.MM.JJJJ' },
                ].map((f, i) => (
                  <div key={i}>
                    <label className="label" style={{ display: 'block', marginBottom: 4 }}>{f.l}</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px', border: '1px solid var(--hair)', borderRadius: 8,
                      background: 'var(--surface)', fontSize: 13,
                    }}>
                      <span style={{ flex: 1 }}>{f.v}</span>
                      <Icon name="chevD" size={13} style={{ color: 'var(--ink-3)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Frame>
  );
};

Object.assign(window, { PageKreditoren, PageKontenplan, PageKontendetail, PageGlobalRules, PageSettings });
