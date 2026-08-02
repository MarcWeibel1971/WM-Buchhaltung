/* global React, Icon, Pill, Btn, Conf, Frame, Topbar, CopilotDock, SectionLabel */
// KLAX Part 3 — Rechnungen, Berichte, MWST, Login, Onboarding, Design-System

// ────────────────── RECHNUNGEN ──────────────────
const PageRechnungen = () => (
  <Frame active="rechnungen">
    <Topbar
      title="Rechnungen"
      subtitle="7 offen · CHF 48’210 · Ø Zahlungsdauer 23 Tage"
      actions={<>
        <Btn size="sm" icon="download">QR-Rechnungen</Btn>
        <Btn variant="primary" size="sm" icon="plus">Neue Rechnung</Btn>
      </>}
    />
    <div style={{ padding: '24px 32px', overflow: 'auto' }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Offen', v: '48’210.00', sub: '7 Rechnungen' },
          { l: 'Überfällig', v: '12’450.00', sub: '3 Rechnungen', neg: true },
          { l: 'Bezahlt YTD', v: '184’920.00', sub: '42 Rechnungen', pos: true },
          { l: 'Entwürfe', v: '2', sub: 'Noch nicht versendet' },
        ].map(k => (
          <div key={k.l} className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{k.l}</div>
            <div className="num display" style={{
              fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 4,
              color: k.neg ? 'var(--neg)' : k.pos ? 'var(--pos)' : 'var(--ink)'
            }}>
              {k.v.includes('.') ? `CHF ${k.v}` : k.v}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--hair)' }}>
        {['Alle', 'Offen (7)', 'Überfällig (3)', 'Bezahlt', 'Entwürfe', 'Mahnwesen'].map((t, i) => (
          <div key={t} style={{
            padding: '10px 14px', fontSize: 13,
            borderBottom: i === 1 ? '2px solid var(--accent)' : '2px solid transparent',
            color: i === 1 ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i === 1 ? 500 : 400,
            marginBottom: -1,
          }}>{t}</div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Nr.</th>
              <th>Kunde</th>
              <th style={{ width: 110 }}>Datum</th>
              <th style={{ width: 110 }}>Fällig</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 130, textAlign: 'right' }}>Betrag</th>
              <th style={{ width: 100, textAlign: 'right' }}>Offen</th>
            </tr>
          </thead>
          <tbody>
            {[
              { n: 'R-0098', k: 'Bauhaus Architekten GmbH', d: '20.04.26', f: '20.05.26', s: 'sent', a: '8’420.00', o: '8’420.00' },
              { n: 'R-0097', k: 'Hofer Architekten AG', d: '05.04.26', f: '05.05.26', s: 'paid', a: '4’280.00', o: '0.00' },
              { n: 'R-0096', k: 'Schmid GmbH', d: '02.04.26', f: '02.05.26', s: 'partial', a: '6’100.00', o: '3’260.00' },
              { n: 'R-0095', k: 'Gemeinde Uster', d: '28.03.26', f: '27.04.26', s: 'due', a: '12’800.00', o: '12’800.00' },
              { n: 'R-0094', k: 'Kunstverein Winterthur', d: '15.03.26', f: '14.04.26', s: 'overdue', a: '3’450.00', o: '3’450.00' },
              { n: 'R-0093', k: 'Meier + Partner AG', d: '12.03.26', f: '11.04.26', s: 'overdue', a: '6’200.00', o: '6’200.00' },
              { n: 'R-0092', k: 'Keller Bau', d: '08.03.26', f: '07.04.26', s: 'overdue', a: '2’800.00', o: '2’800.00' },
              { n: 'R-0091', k: 'Privatperson A. Meier', d: '01.03.26', f: '31.03.26', s: 'draft', a: '1’420.00', o: '—' },
            ].map((r, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{r.n}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: 'var(--ink-3)' }}>
                      {r.k.split(' ').map(w => w[0]).slice(0,2).join('')}
                    </div>
                    <span style={{ fontSize: 13 }}>{r.k}</span>
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.d}</td>
                <td className="mono" style={{ fontSize: 12, color: r.s === 'overdue' ? 'var(--neg)' : 'var(--ink-3)' }}>{r.f}</td>
                <td>
                  {r.s === 'sent' && <Pill variant="info">Versendet</Pill>}
                  {r.s === 'paid' && <Pill variant="pos" icon="check">Bezahlt</Pill>}
                  {r.s === 'partial' && <Pill variant="warn">Teilzahlung</Pill>}
                  {r.s === 'due' && <Pill>Offen</Pill>}
                  {r.s === 'overdue' && <Pill variant="neg" icon="warn">Überfällig</Pill>}
                  {r.s === 'draft' && <Pill>Entwurf</Pill>}
                </td>
                <td className="num" style={{ textAlign: 'right', fontSize: 13 }}>CHF {r.a}</td>
                <td className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 500,
                  color: r.s === 'paid' ? 'var(--pos)' : r.s === 'overdue' ? 'var(--neg)' : 'var(--ink)' }}>
                  {r.o === '0.00' ? '—' : `CHF ${r.o}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </Frame>
);

// ────────────────── BERICHTE ──────────────────
const PageBerichte = () => (
  <Frame active="berichte">
    <Topbar
      title="Erfolgsrechnung"
      subtitle="Weibel-Müller AG · GJ 2026 · Jan–Apr"
      breadcrumbs={['Berichte', 'Erfolgsrechnung']}
      actions={<>
        <Btn size="sm" icon="download">PDF</Btn>
        <Btn size="sm" icon="download">Excel</Btn>
        <Btn size="sm">Vergleichen mit…</Btn>
      </>}
    />
    <div style={{ padding: '24px 32px', overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
      <div>
        {/* Period switcher */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <div className="card card--soft" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Icon name="calendar" size={13} />
            <span>01.01.2026 – 23.04.2026</span>
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 3, borderRadius: 8 }}>
            {['YTD', 'Q1', 'Q2', 'Monat', 'Custom'].map((t, i) => (
              <button key={t} style={{
                padding: '4px 10px', fontSize: 11.5, border: 'none',
                background: i === 0 ? 'var(--surface)' : 'transparent',
                color: i === 0 ? 'var(--ink)' : 'var(--ink-3)',
                borderRadius: 5, fontWeight: 500,
                boxShadow: i === 0 ? 'var(--shadow-1)' : 'none',
                cursor: 'pointer'
              }}>{t}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <Pill variant="ai" icon="sparkle">KI-Erklärung</Pill>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { title: 'Betrieblicher Ertrag', total: 342820.40, posGrow: true, children: [
              { k: '3200 Dienstleistungsertrag', v: 328420.40 },
              { k: '3400 Materialertrag', v: 14400.00 },
            ]},
            { title: 'Betrieblicher Aufwand', total: -279980.25, children: [
              { k: '4000 Material- & Warenaufwand', v: -42180.00 },
              { k: '5000 Personalaufwand', v: -178420.15 },
              { k: '6000 Raumaufwand', v: -18400.00 },
              { k: '6400 Energie', v: -2840.20 },
              { k: '6510 Telekom', v: -1720.30 },
              { k: '6540 IT-Dienstleistungen', v: -4840.00 },
              { k: '6570 Büromaterial', v: -1280.60 },
              { k: '6580 Repräsentation', v: -2100.00 },
              { k: '6700 Versicherungen', v: -3368.00 },
              { k: '6800 Bankspesen', v: -74.00 },
              { k: '6900 Sonstiger Betriebsaufwand', v: -24757.00 },
            ]},
            { title: 'Betriebsergebnis (EBIT)', total: 62840.15, highlight: true },
          ].map((sec, i) => (
            <div key={i} style={{ borderBottom: i < 2 ? '1px solid var(--hair)' : 'none' }}>
              <div style={{
                padding: '14px 18px',
                background: sec.highlight ? 'var(--accent-soft)' : 'transparent',
                display: 'flex', alignItems: 'center',
                borderBottom: sec.children ? '1px solid var(--hair)' : 'none',
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: sec.highlight ? 'var(--accent)' : 'var(--ink)' }}>{sec.title}</span>
                <span className="num" style={{ fontSize: 15, fontWeight: 500, color: sec.highlight ? 'var(--accent)' : sec.total > 0 ? 'var(--pos)' : 'var(--ink)' }}>
                  CHF {sec.total.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {sec.children?.map((c, j) => {
                const maxAbs = Math.max(...sec.children.map(x => Math.abs(x.v)));
                const pct = (Math.abs(c.v) / maxAbs) * 100;
                return (
                  <div key={j} style={{
                    padding: '10px 18px', display: 'grid', gridTemplateColumns: '220px 1fr 140px',
                    gap: 16, alignItems: 'center', fontSize: 12.5,
                  }}>
                    <span>{c.k}</span>
                    <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: c.v > 0 ? 'var(--accent)' : 'var(--hair-strong)' }} />
                    </div>
                    <span className="num" style={{ textAlign: 'right', color: c.v > 0 ? 'var(--pos)' : 'var(--ink-2)' }}>
                      {c.v > 0 ? '+' : ''}{c.v.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KI narrative */}
        <div className="card" style={{ padding: 18, borderColor: 'var(--ai-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="sparkle" size={14} style={{ color: 'var(--ai)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--ai)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Was Klax sieht</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink)' }}>
            Deine Marge liegt mit <b>18.4%</b> um 2.1 pp über dem Vorjahresschnitt. Der Personalaufwand ist nach der Einstellung von L. Keller im Februar wie erwartet gestiegen.
            Auffällig: <b>Repräsentation</b> ist bereits im April bei 84% des Jahresbudgets.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost">Nach Projekt aufschlüsseln</Btn>
            <Btn size="sm" variant="ghost">Vs. Budget</Btn>
          </div>
        </div>

        {/* Vertical ratio */}
        <div className="card" style={{ padding: 18 }}>
          <SectionLabel>Vertikalstruktur</SectionLabel>
          {[
            { l: 'Personal', p: 52, v: '52.1%' },
            { l: 'Material', p: 12, v: '12.3%' },
            { l: 'Raum', p: 6, v: '5.4%' },
            { l: 'Sonstiges', p: 12, v: '11.8%' },
            { l: 'Ergebnis', p: 18, v: '18.4%', accent: true },
          ].map(r => (
            <div key={r.l} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: r.accent ? 'var(--accent)' : 'var(--ink-2)', fontWeight: r.accent ? 500 : 400 }}>{r.l}</span>
                <span className="num" style={{ color: 'var(--ink-3)' }}>{r.v}</span>
              </div>
              <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${r.p}%`, height: '100%', background: r.accent ? 'var(--accent)' : 'var(--hair-strong)' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card card--soft" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>Nächste Frist</div>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>MWST Q2 · 31.08.2026</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>Klax sammelt Belege automatisch</div>
        </div>
      </div>
    </div>
  </Frame>
);

// ────────────────── MWST ──────────────────
const PageMwst = () => (
  <Frame active="mwst">
    <Topbar
      title="MWST · Q2 / 2026"
      subtitle="Abrechnungsperiode 01.04.–30.06.2026 · Fällig 31.08.2026 · Saldosteuersatz 6.5%"
      actions={<>
        <Btn size="sm">Entwurf speichern</Btn>
        <Btn size="sm" icon="download">Export XML</Btn>
        <Btn variant="primary" size="sm" icon="check">An ESTV übermitteln</Btn>
      </>}
    />
    <div style={{ padding: '24px 32px', overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div>
          {/* Progress stepper */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 20, padding: 14,
            background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--hair)',
          }}>
            {[
              { l: 'Belege erfasst', done: true },
              { l: 'MWST-Codes geprüft', done: true },
              { l: 'Abrechnung ausgefüllt', done: true, active: true },
              { l: 'Prüfen', done: false },
              { l: 'Übermitteln', done: false },
            ].map((s, i) => (
              <React.Fragment key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: s.done ? 'var(--accent)' : s.active ? 'var(--surface)' : 'var(--surface-2)',
                    color: s.done ? 'var(--accent-ink)' : 'var(--ink-3)',
                    border: s.active ? '2px solid var(--accent)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
                  }}>
                    {s.done ? <Icon name="check" size={11} stroke={2.5} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: s.done || s.active ? 'var(--ink)' : 'var(--ink-3)', fontWeight: s.active ? 500 : 400 }}>{s.l}</span>
                </div>
                {i < 4 && <div style={{ flex: 1, height: 1, background: s.done ? 'var(--accent)' : 'var(--hair)', alignSelf: 'center' }} />}
              </React.Fragment>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 500 }}>Abrechnungsformular</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>Automatisch aus 87 Belegen generiert</div>
              </div>
              <Pill variant="ai" icon="sparkle">Klax vorbereitet</Pill>
            </div>

            {[
              { head: 'Leistungen', rows: [
                ['200', 'Total vereinbartes Entgelt', '172’420.00'],
                ['220', 'Davon steuerbar zum Normalsatz 8.1%', '168’940.00'],
                ['299', 'Von Steuer ausgenommene Leistungen', '3’480.00'],
              ]},
              { head: 'Geschuldete Steuer', rows: [
                ['302', 'Normalsatz 8.1%', '13’684.14'],
                ['303', 'Sondersatz 3.8%', '—'],
                ['379', 'Total geschuldete Steuer', '13’684.14', true],
              ]},
              { head: 'Vorsteuer', rows: [
                ['400', 'Vorsteuer auf Material & Dienstleistungen', '3’420.80'],
                ['405', 'Vorsteuer auf Investitionen', '842.00'],
                ['479', 'Total Vorsteuer', '4’262.80', true],
              ]},
              { head: 'Saldo', rows: [
                ['500', 'Zu bezahlender Betrag', '9’421.34', true, true],
              ]},
            ].map((sec, i) => (
              <div key={i} style={{ borderBottom: i < 3 ? '1px solid var(--hair)' : 'none' }}>
                <div style={{ padding: '10px 18px', background: 'var(--surface-2)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sec.head}</div>
                {sec.rows.map((r, j) => (
                  <div key={j} style={{
                    padding: '10px 18px',
                    display: 'grid', gridTemplateColumns: '60px 1fr 160px',
                    alignItems: 'center', gap: 12, fontSize: 13,
                    background: r[4] ? 'var(--accent-soft)' : 'transparent',
                    borderTop: j > 0 ? '1px solid var(--hair)' : 'none',
                  }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r[0]}</span>
                    <span style={{ fontWeight: r[3] ? 500 : 400, color: r[4] ? 'var(--accent)' : 'var(--ink)' }}>{r[1]}</span>
                    <span className="num" style={{ textAlign: 'right', fontSize: r[3] ? 15 : 13, fontWeight: r[3] ? 500 : 400, color: r[4] ? 'var(--accent)' : 'var(--ink)' }}>
                      CHF {r[2]}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <SectionLabel accent icon="sparkle">KI-Prüfung</SectionLabel>
            {[
              { t: 'Alle MWST-Codes konsistent', ok: true },
              { t: 'Bezugsteuer korrekt erfasst', ok: true, sub: '4 Dienstleistungsimporte' },
              { t: 'Kein Beleg ohne MWST-Code', ok: true },
              { t: '2 Belege knapp vor Periodenende prüfen', ok: false },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--hair)' : 'none' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 999,
                  background: c.ok ? 'var(--pos-soft)' : 'var(--warn-soft)',
                  color: c.ok ? 'var(--pos)' : 'var(--warn)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Icon name={c.ok ? 'check' : 'warn'} size={10} stroke={2.5} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.t}</div>
                  {c.sub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{c.sub}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="card card--soft" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Im Vergleich zu Q1</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
              <span>Umsatz steuerbar</span><span className="num">+12.4%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Vorsteuerquote</span><span className="num">2.5% (Ø)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Frame>
);

// ────────────────── LOGIN ──────────────────
const PageLogin = () => (
  <div className="klax" style={{ width: 1440, height: 900, display: 'grid', gridTemplateColumns: '1fr 520px', background: 'var(--paper)' }}>
    <div style={{ padding: 48, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <Logo />

      <div style={{ marginTop: 'auto' }}>
        {/* Typographic headline */}
        <div className="display" style={{ fontSize: 72, lineHeight: 0.95, letterSpacing: '-0.04em', fontWeight: 500, color: 'var(--ink)', marginBottom: 24 }}>
          Buchhaltung,<br />
          <span style={{ color: 'var(--accent)' }}>die mitdenkt.</span>
        </div>
        <div style={{ fontSize: 17, color: 'var(--ink-2)', maxWidth: 520, lineHeight: 1.5 }}>
          Klax liest deine Belege, kontiert sie nach Schweizer Vorschriften und bereitet die MWST-Abrechnung vor. Du gibst nur noch frei.
        </div>

        <div style={{ display: 'flex', gap: 32, marginTop: 40, fontSize: 12, color: 'var(--ink-3)' }}>
          {['ISO 27001', 'Swiss Hosting', 'OR 957', 'KMU ab CHF 19/Mt.'].map(x => (
            <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check" size={11} style={{ color: 'var(--accent)' }} />
              {x}
            </div>
          ))}
        </div>
      </div>

      {/* Abstract chart placeholder — reflects 'reads belege' */}
      <div style={{
        position: 'absolute', top: 48, right: 48, width: 240, height: 320,
        border: '1px solid var(--hair)', borderRadius: 14, padding: 18,
        background: 'var(--surface)', boxShadow: 'var(--shadow-2)',
        transform: 'rotate(-2deg)'
      }}>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Beleg → Buchung</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>swisscom_R0142.pdf</div>
        <div style={{ height: 1, background: 'var(--hair)', margin: '12px 0' }} />
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>extrahiert</div>
        <div style={{ fontSize: 12 }}><b>CHF 142.90</b> · 8.1%</div>
        <div style={{ height: 1, background: 'var(--hair)', margin: '12px 0' }} />
        <div style={{ fontSize: 11, color: 'var(--ai)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <Icon name="sparkle" size={11} /> Vorschlag
        </div>
        <div className="mono" style={{ fontSize: 10.5 }}>
          6510 <span style={{ color: 'var(--ink-4)' }}>→</span> 2000
        </div>
        <div style={{ marginTop: 16, padding: 10, background: 'var(--pos-soft)', borderRadius: 8, fontSize: 11, color: 'var(--pos)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="check" size={11} stroke={2} /> Gematcht mit ZKB 15.04.
        </div>
      </div>
    </div>

    {/* Login card */}
    <div style={{ background: 'var(--surface)', borderLeft: '1px solid var(--hair)', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="display" style={{ fontSize: 26, letterSpacing: '-0.02em', fontWeight: 500, marginBottom: 6 }}>Willkommen zurück</div>
      <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 28 }}>Melde dich bei Weibel-Müller AG an.</div>

      {[
        { l: 'E-Mail', v: 'roger@weibel-mueller.ch', t: 'email' },
        { l: 'Passwort', v: '••••••••••••', t: 'password' },
      ].map(f => (
        <div key={f.l} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>{f.l}</span>
            {f.t === 'password' && <a style={{ color: 'var(--accent)', fontSize: 11.5 }}>Vergessen?</a>}
          </div>
          <div style={{
            padding: '10px 12px', border: '1px solid var(--hair-strong)', borderRadius: 8,
            fontSize: 13.5, background: 'var(--paper)',
            color: 'var(--ink)', fontFamily: f.t === 'password' ? 'var(--font-mono)' : 'inherit',
            letterSpacing: f.t === 'password' ? '0.25em' : 'normal',
          }}>
            {f.v}
          </div>
        </div>
      ))}

      <button style={{
        marginTop: 18, padding: '12px 14px', border: 'none', borderRadius: 8,
        background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 13.5, fontWeight: 500,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        Anmelden
        <Icon name="arrow" size={14} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', fontSize: 11, color: 'var(--ink-4)' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
        <span>oder</span>
        <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
      </div>

      <button className="btn" style={{ justifyContent: 'center', padding: '10px 14px' }}>
        <span style={{ width: 14, height: 14, display: 'inline-block', background: '#4285F4', borderRadius: 2 }} />
        Mit Google anmelden
      </button>

      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12.5, color: 'var(--ink-3)' }}>
        Noch kein Konto? <a style={{ color: 'var(--accent)', fontWeight: 500 }}>30 Tage gratis testen</a>
      </div>
    </div>
  </div>
);

// ────────────────── ONBOARDING ──────────────────
const PageOnboarding = () => (
  <div className="klax" style={{ width: 1440, height: 900, background: 'var(--paper)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 24 }}>
      <Logo />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 520 }}>
        {['Firma', 'Kontenplan', 'Bank', 'Belege', 'Fertig'].map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                background: i < 2 ? 'var(--accent)' : i === 2 ? 'var(--surface)' : 'var(--surface-2)',
                color: i < 2 ? 'var(--accent-ink)' : 'var(--ink-3)',
                border: i === 2 ? '2px solid var(--accent)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
              }}>
                {i < 2 ? <Icon name="check" size={11} stroke={2.5} /> : i + 1}
              </div>
              <span style={{ fontSize: 12, color: i <= 2 ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i === 2 ? 500 : 400 }}>{s}</span>
            </div>
            {i < 4 && <div style={{ flex: 1, height: 1, background: i < 2 ? 'var(--accent)' : 'var(--hair)' }} />}
          </React.Fragment>
        ))}
      </div>
      <Btn variant="ghost" size="sm">Später</Btn>
    </div>

    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 560px', overflow: 'hidden' }}>
      <div style={{ padding: 48, overflow: 'auto' }}>
        <div style={{ maxWidth: 540 }}>
          <Pill variant="ai" icon="sparkle">Schritt 3 von 5</Pill>
          <div className="display" style={{ fontSize: 36, letterSpacing: '-0.025em', fontWeight: 500, marginTop: 16, lineHeight: 1.1 }}>
            Verbinde dein Bankkonto.
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.55 }}>
            Klax liest Transaktionen täglich automatisch ein und matcht sie mit deinen Belegen. CAMT.053 wird unterstützt — oder du nutzt die API deiner Bank.
          </div>

          <div style={{ marginTop: 32, display: 'grid', gap: 10 }}>
            {[
              { n: 'ZKB · Zürcher Kantonalbank', d: 'Direktverbindung · empfohlen', a: true },
              { n: 'UBS · Swiss Banking API', d: 'OAuth · täglicher Abzug' },
              { n: 'Raiffeisen', d: 'CAMT.053 Upload' },
              { n: 'PostFinance', d: 'API oder CAMT' },
              { n: 'Neon / Revolut / Wise', d: 'CAMT oder CSV' },
              { n: 'Ich verbinde später', d: 'Du kannst Belege auch ohne Bank hochladen' },
            ].map((b, i) => (
              <div key={b.n} style={{
                padding: 14, border: `1px solid ${b.a ? 'var(--accent)' : 'var(--hair)'}`,
                background: b.a ? 'var(--accent-soft)' : 'var(--surface)',
                borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Icon name="bank" size={16} style={{ color: 'var(--ink-3)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{b.n}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{b.d}</div>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: 999,
                  border: `2px solid ${b.a ? 'var(--accent)' : 'var(--hair-strong)'}`,
                  background: b.a ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {b.a && <Icon name="check" size={10} stroke={3} style={{ color: 'var(--accent-ink)' }} />}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            <Btn>Zurück</Btn>
            <div style={{ flex: 1 }} />
            <Btn variant="primary" iconRight="arrow">Weiter zu Belegen</Btn>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div style={{
        background: 'var(--surface-2)', borderLeft: '1px solid var(--hair)',
        padding: 32, display: 'flex', flexDirection: 'column', gap: 14
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>So wird dein Dashboard aussehen</div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Liquidität (Mock)</div>
          <div className="num display" style={{ fontSize: 28, fontWeight: 500, marginTop: 4 }}>CHF 284’520.40</div>
          <div style={{ height: 40, marginTop: 10, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{
                flex: 1, background: 'var(--accent)',
                height: `${30 + Math.abs(Math.sin(i*0.6))*70}%`, borderRadius: 2, opacity: 0.6 + (i/20)*0.4
              }} />
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="sparkle" size={14} style={{ color: 'var(--ai)' }} />
          <div style={{ fontSize: 12.5 }}>14 Belege bereit zur Kontierung</div>
        </div>

        <div className="card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="link" size={14} style={{ color: 'var(--pos)' }} />
          <div style={{ fontSize: 12.5 }}>9 Banktx auto-gematcht</div>
        </div>

        <div className="card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="check" size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 12.5 }}>MWST Q2 Entwurf fertig</div>
        </div>

        <div style={{ marginTop: 'auto', padding: 14, background: 'var(--surface)', borderRadius: 10, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <b style={{ color: 'var(--ink)' }}>Keine Sorge</b> — wir importieren nur lesend. Keine Überweisungen ohne deine Freigabe.
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { PageRechnungen, PageBerichte, PageMwst, PageLogin, PageOnboarding });
