/* global React, Icon, Pill, Btn, Conf, Frame, Topbar, CopilotDock, SectionLabel */
// KLAX page mockups Part 2 — Belege list+detail, Bank, Freigaben

// ────────────────── BELEGE (LISTE) ──────────────────
const PageBelegeListe = () => (
  <Frame active="belege">
    <Topbar
      title="Belege"
      subtitle="124 Belege · 89% automatisch kontiert · 12 warten auf Freigabe"
      actions={<>
        <Btn size="sm" icon="download">Export</Btn>
        <Btn size="sm">Bulk-Aktion</Btn>
        <Btn variant="primary" size="sm" icon="upload">Hochladen</Btn>
      </>}
    />
    <div style={{ padding: '20px 32px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {[
        { l: 'Alle', c: 124, a: true },
        { l: 'Neu', c: 8 },
        { l: 'KI-verarbeitet', c: 104 },
        { l: 'Zu prüfen', c: 12 },
        { l: 'Gematcht', c: 96 },
        { l: 'Archiv', c: 1204 },
      ].map(t => (
        <div key={t.l} style={{
          padding: '6px 12px', borderRadius: 999,
          background: t.a ? 'var(--ink)' : 'transparent',
          color: t.a ? '#F4F1EA' : 'var(--ink-2)',
          border: t.a ? '1px solid var(--ink)' : '1px solid var(--hair)',
          fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center'
        }}>
          <span>{t.l}</span>
          <span className="num" style={{ fontSize: 11, color: t.a ? 'rgba(255,255,255,0.65)' : 'var(--ink-4)' }}>{t.c}</span>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12
      }}>
        <Icon name="search" size={13} />
        <span style={{ color: 'var(--ink-4)' }}>Lieferant, Betrag, Buchungstext…</span>
      </div>
    </div>

    <div style={{ padding: '16px 32px 32px', overflow: 'auto' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}><div style={{ width: 14, height: 14, border: '1.5px solid var(--hair-strong)', borderRadius: 4 }} /></th>
              <th style={{ width: 90 }}>Datum</th>
              <th>Lieferant / Text</th>
              <th style={{ width: 180 }}>Konto</th>
              <th style={{ width: 110 }}>MWST</th>
              <th style={{ width: 140 }}>KI</th>
              <th style={{ width: 100 }}>Match</th>
              <th style={{ width: 130, textAlign: 'right' }}>Betrag</th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {[
              { d: '23.04.26', v: 'Swisscom (Schweiz) AG', sub: 'Rechnung R-0142 · April 2026', acc: '6510 Telekom', vat: '8.1% (Vorst.)', conf: 97, match: 'pos', amt: '142.90' },
              { d: '22.04.26', v: 'Google Ireland Ltd.', sub: 'Workspace · 6 users', acc: '6540 IT-Dienst.', vat: 'Bezug Ausland', conf: 99, match: 'pos', amt: '84.00' },
              { d: '22.04.26', v: 'ZKB · Kontogebühren', sub: 'Monat April 2026', acc: '6800 Bankspesen', vat: 'keine MWST', conf: 100, match: 'pos', amt: '18.50' },
              { d: '21.04.26', v: 'Hofer Architekten AG', sub: 'Honorarrechnung R-0097 (Ausgang)', acc: '3200 Dienstl.', vat: '8.1% (Umsatz)', conf: 100, match: 'pos', amt: '4’280.00', pos: true },
              { d: '20.04.26', v: 'Coop Pronto Oerlikon', sub: 'Bewirtung Kunde (Kreditkarte)', acc: '6580 Repr.', vat: '2.6%', conf: 72, match: 'warn', amt: '118.40', warn: true },
              { d: '20.04.26', v: 'Migros', sub: 'Büromaterial · Kassazettel', acc: '6570 Büro', vat: '8.1% (Vorst.)', conf: 84, match: 'warn', amt: '64.20' },
              { d: '19.04.26', v: 'SBB CFF FFS', sub: 'GA 2. Klasse (anteilig)', acc: '6220 Reisekosten', vat: '—', conf: 91, match: 'pos', amt: '295.00' },
              { d: '18.04.26', v: 'IWB Basel', sub: 'Strom Q1 2026', acc: '6400 Energie', vat: '8.1% (Vorst.)', conf: 96, match: 'pos', amt: '612.80' },
              { d: '17.04.26', v: 'Helvetia Versicherungen', sub: 'Betriebshaftpflicht', acc: '6700 Versich.', vat: 'ausgenommen', conf: 98, match: 'pos', amt: '842.00' },
              { d: '17.04.26', v: 'Adobe Systems', sub: 'Creative Cloud · Abo', acc: '6540 IT-Dienst.', vat: 'Bezug Ausland', conf: 99, match: 'pos', amt: '74.35' },
              { d: '16.04.26', v: 'Beleg #0413', sub: 'Kassazettel · keine OCR möglich', acc: '— offen —', vat: '—', conf: 0, match: 'none', amt: '32.90', open: true },
              { d: '15.04.26', v: 'SBB Card Services', sub: 'KK-Abrechnung April', acc: '2100 Kreditkarte', vat: 'keine MWST', conf: 100, match: 'pos', amt: '2’140.50' },
            ].map((r, i) => (
              <tr key={i}>
                <td><div style={{ width: 14, height: 14, border: '1.5px solid var(--hair-strong)', borderRadius: 4 }} /></td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.d}</td>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                      width: 28, height: 34, borderRadius: 3,
                      background: r.open ? 'var(--warn-soft)' : 'var(--surface-2)',
                      border: '1px solid var(--hair)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name="file" size={13} style={{ color: 'var(--ink-4)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.v}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{r.sub}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 12, color: r.open ? 'var(--warn)' : 'var(--ink-2)' }}>{r.acc}</td>
                <td style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.vat}</td>
                <td>
                  {r.conf === 0
                    ? <Pill variant="warn" icon="warn">Manuell</Pill>
                    : r.warn
                      ? <Pill variant="warn" icon="warn">{r.conf}%</Pill>
                      : <Conf value={r.conf} />
                  }
                </td>
                <td>
                  {r.match === 'pos' && <Pill variant="pos" icon="link">OK</Pill>}
                  {r.match === 'warn' && <Pill variant="warn">Vorschlag</Pill>}
                  {r.match === 'none' && <Pill>—</Pill>}
                </td>
                <td className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: r.pos ? 'var(--pos)' : 'var(--ink)' }}>
                  {r.pos && '+'}CHF {r.amt}
                </td>
                <td><Icon name="chevR" size={13} style={{ color: 'var(--ink-4)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <CopilotDock />
  </Frame>
);

// ────────────────── BELEG DETAIL ──────────────────
const PageBelegDetail = () => (
  <Frame active="belege">
    <Topbar
      breadcrumbs={['Belege', 'Swisscom · R-0142']}
      title="Swisscom (Schweiz) AG"
      subtitle="Beleg R-0142 · Eingang 23.04.2026 · PDF · 1 Seite"
      actions={<>
        <Btn size="sm" icon="x">Ablehnen</Btn>
        <Btn size="sm">Bearbeiten</Btn>
        <Btn variant="primary" size="sm" icon="check">Freigeben & verbuchen</Btn>
      </>}
    />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', flex: 1, minHeight: 0 }}>
      {/* PDF preview */}
      <div style={{ padding: 32, overflow: 'auto', background: 'var(--surface-2)' }}>
        <div style={{
          maxWidth: 560, margin: '0 auto',
          background: 'white', boxShadow: 'var(--shadow-2)',
          borderRadius: 4, padding: 40, minHeight: 700,
          fontSize: 11, color: '#333'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0058a3', paddingBottom: 10, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0058a3', letterSpacing: '-0.02em' }}>swisscom</div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>Postfach, 3050 Bern</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10 }}>
              <div>Rechnung</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>R-0142</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Rechnung an</div>
              <div style={{ marginTop: 4 }}>Weibel-Müller AG</div>
              <div>Bahnhofstrasse 14</div>
              <div>8001 Zürich</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Daten</div>
              <div style={{ marginTop: 4 }}>Datum: 12.04.2026</div>
              <div>Fälligkeit: 12.05.2026</div>
              <div>Kunde: 3421-99801</div>
            </div>
          </div>

          <div style={{ height: 1, background: '#ddd', margin: '20px 0' }} />

          {[
            ['Mobile Abo Plus', '68.00'],
            ['Internet Business 1Gbit', '59.00'],
            ['Rufnummer 043 2XX XX XX', '15.90'],
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #eee', fontSize: 11 }}>
              <span>{r[0]}</span><span className="mono">{r[1]}</span>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 12, fontSize: 11 }}>
            <span>Zwischentotal</span><span className="mono">132.19</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>MWST 8.1%</span><span className="mono">10.71</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #333', fontSize: 13, fontWeight: 700, marginTop: 8 }}>
            <span>Total CHF</span><span className="mono">142.90</span>
          </div>

          {/* OCR overlay hint */}
          <div style={{ marginTop: 24, padding: 10, background: 'var(--ai-soft)', borderRadius: 6, fontSize: 10, color: 'var(--ai)' }}>
            ⬡ Klax hat 14 Felder extrahiert · Klicke, um zuzuordnen
          </div>
        </div>
      </div>

      {/* Right: KI extraction panel */}
      <div style={{ borderLeft: '1px solid var(--hair)', padding: 24, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'var(--ai-soft)', color: 'var(--ai)',
              border: '1px solid var(--ai-line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="sparkle" size={13} stroke={2} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ai)' }}>KI-ANALYSE</div>
            <div style={{ flex: 1 }} />
            <Conf value={97} />
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>
            Wiederkehrende Telefonrechnung von <b>Swisscom</b>. Identisch zur R-0141 vom März. Ich würde auf <b>6510 Telekom-Gebühren</b> mit <b>8.1% Vorsteuer</b> buchen und gegen die ZKB-Transaktion vom 15.04. matchen.
          </div>
        </div>

        <div className="divider" />

        {/* Extracted fields */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Extrahierte Daten</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['Lieferant', 'Swisscom (Schweiz) AG', 99],
              ['UID', 'CHE-101.654.833 MWST', 99],
              ['Rechnungs-Nr.', 'R-0142', 99],
              ['Rechnungsdatum', '12.04.2026', 100],
              ['Fälligkeit', '12.05.2026', 100],
              ['Total (inkl. MWST)', 'CHF 142.90', 100],
              ['MWST-Betrag', 'CHF 10.71 (8.1%)', 98],
              ['Währung', 'CHF', 100],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0, width: 110 }}>{k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{v}</span>
                <Conf value={c} />
              </div>
            ))}
          </div>
        </div>

        <div className="divider" />

        {/* Booking proposal */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Buchungsvorschlag</div>
          <div className="card card--soft" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="arrow" size={13} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 12 }}><b>6510</b> Telekom-Gebühren</span>
              <span style={{ flex: 1 }} />
              <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>132.19</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="arrow" size={13} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 12 }}><b>1171</b> Vorsteuer 8.1%</span>
              <span style={{ flex: 1 }} />
              <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>10.71</span>
            </div>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 13, height: 13, borderRadius: 999, background: 'var(--neg-soft)', color: 'var(--neg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>−</span>
              <span style={{ fontSize: 12 }}><b>2000</b> Kreditoren Swisscom</span>
              <span style={{ flex: 1 }} />
              <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>142.90</span>
            </div>
          </div>
        </div>

        {/* Match */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Bank-Match</div>
          <div style={{
            padding: 12, border: '1px solid var(--pos)', background: 'var(--pos-soft)',
            borderRadius: 10, display: 'flex', gap: 12, alignItems: 'center'
          }}>
            <Icon name="link" size={16} style={{ color: 'var(--pos)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>ZKB · 15.04.2026 · eBanking-Lastschrift</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Exakte Betrags- und Referenzübereinstimmung</div>
            </div>
            <span className="num" style={{ fontSize: 13, fontWeight: 500, color: 'var(--pos)' }}>−CHF 142.90</span>
          </div>
        </div>
      </div>
    </div>
  </Frame>
);

// ────────────────── BANK / MATCHING ──────────────────
const PageBank = () => (
  <Frame active="bank">
    <Topbar
      title="Bank · Matching"
      subtitle="ZKB Geschäftskonto · CH93 0076 2011 6238 5295 7 · Saldo CHF 284’520.40"
      actions={<>
        <Btn size="sm" icon="download">CAMT.053</Btn>
        <Btn size="sm" icon="upload">Import</Btn>
        <Btn variant="primary" size="sm" icon="sparkle">Auto-Match (Klax)</Btn>
      </>}
    />
    <div style={{ padding: '16px 32px 0', display: 'flex', gap: 8 }}>
      {[
        { l: 'Alle Transaktionen', c: 143 },
        { l: 'Ungematcht', c: 3, active: true },
        { l: 'KI-Vorschlag', c: 11 },
        { l: 'Gematcht', c: 129 },
      ].map(t => (
        <div key={t.l} style={{
          padding: '6px 12px', borderRadius: 6,
          background: t.active ? 'var(--accent-soft)' : 'transparent',
          color: t.active ? 'var(--accent)' : 'var(--ink-2)',
          border: t.active ? '1px solid var(--accent-line)' : '1px solid transparent',
          fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center',
          fontWeight: t.active ? 500 : 400,
        }}>
          <span>{t.l}</span>
          <span className="num" style={{ fontSize: 11, color: t.active ? 'var(--accent)' : 'var(--ink-4)' }}>{t.c}</span>
        </div>
      ))}
    </div>

    <div style={{ padding: '12px 32px 32px', overflow: 'auto' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        {[
          {
            date: '23.04.26', desc: 'Swisscom (Schweiz) AG',
            ref: 'QR-Ref 000000000271700041928000190', amt: -142.90,
            match: { conf: 97, text: 'Beleg R-0142 vom 12.04.26 · exakter Betrag', pos: true }
          },
          {
            date: '22.04.26', desc: 'Eingang Hofer Architekten AG',
            ref: 'QR-Ref R-0097', amt: 4280.00,
            match: { conf: 99, text: 'Eigene Rechnung R-0097 · offen seit 05.04.26', pos: true, inv: true }
          },
          {
            date: '22.04.26', desc: 'IBAN DE89 3704 0044 · Amazon EU SARL',
            ref: 'Ref. DE-INV-8834 Büroausstattung', amt: -412.50,
            match: { suggest: true, conf: 62, text: 'Kein passender Beleg. Vorschlag: neu anlegen als 6570 Büromaterial.' },
            unmatched: true,
          },
          {
            date: '21.04.26', desc: 'Kontogebühr ZKB Business',
            ref: 'Monat April', amt: -18.50,
            match: { conf: 100, text: 'Regel aktiv: → 6800 Bankspesen', pos: true }
          },
          {
            date: '20.04.26', desc: 'UBS Lohn · Leonie Keller',
            ref: 'Lohn April 2026', amt: -5840.00,
            match: { conf: 100, text: 'Lohnlauf 04/26 · Position 3/7', pos: true }
          },
          {
            date: '19.04.26', desc: 'Zahlungseingang · Schmid GmbH',
            ref: 'ohne Referenz · CHF 2’840.00', amt: 2840.00,
            match: { suggest: true, conf: 84, text: 'Wahrscheinlich R-0091 (Schmid GmbH) – Betrag & Kunde passen.' },
            unmatched: true,
          },
          {
            date: '18.04.26', desc: 'Migros, Zürich Oerlikon',
            ref: 'Kassenbon', amt: -64.20,
            match: { suggest: true, conf: 72, text: '3 Belege passen – Klax fragt nach.' },
            unmatched: true,
          },
        ].map((t, i) => (
          <div key={i} className="card" style={{
            padding: 0, overflow: 'hidden',
            borderLeft: t.unmatched ? '3px solid var(--warn)' : '3px solid transparent',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 140px 28px', alignItems: 'center', padding: '14px 16px', gap: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t.date}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>ZKB</div>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.desc}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{t.ref}</div>
              </div>
              <div className="num" style={{
                fontSize: 15, fontWeight: 500, textAlign: 'right',
                color: t.amt > 0 ? 'var(--pos)' : 'var(--ink)'
              }}>
                {t.amt > 0 ? '+' : '−'}CHF {Math.abs(t.amt).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
              </div>
              <Icon name="chevD" size={14} style={{ color: 'var(--ink-4)' }} />
            </div>

            {/* Match strip */}
            <div style={{
              padding: '10px 16px 14px', background: t.match.pos ? 'var(--pos-soft)' : 'var(--warn-soft)',
              borderTop: '1px solid var(--hair)',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: t.match.pos ? 'var(--pos)' : 'var(--warn)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon name={t.match.pos ? 'check' : 'sparkle'} size={12} stroke={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: t.match.pos ? 'var(--pos)' : 'var(--warn)' }}>
                  {t.match.pos ? (t.match.inv ? 'Mit Ausgangsrechnung verbunden' : 'Automatisch gematcht') : 'Klax schlägt vor'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 1 }}>{t.match.text}</div>
              </div>
              <Conf value={t.match.conf} />
              {t.unmatched && <>
                <Btn size="sm">Anderer Beleg</Btn>
                <Btn size="sm" variant="primary" icon="check">Annehmen</Btn>
              </>}
            </div>
          </div>
        ))}
      </div>
    </div>
  </Frame>
);

// ────────────────── FREIGABEN ──────────────────
const PageFreigaben = () => (
  <Frame active="freigaben">
    <Topbar
      title="Freigaben"
      subtitle="12 Buchungen bereit · 2 mit Warnung · alle revisionssicher"
      actions={<>
        <Btn size="sm" icon="eye">Vorschau PDF</Btn>
        <Btn variant="primary" size="sm" icon="check">Alle 12 freigeben</Btn>
      </>}
    />
    <div style={{ padding: '16px 32px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
      {[
        { l: 'Bereit (12)', a: true }, { l: 'Warnungen (2)' },
        { l: 'Manuell angepasst (3)' }, { l: 'Verbucht (428)' },
      ].map(t => (
        <div key={t.l} style={{
          padding: '6px 12px', fontSize: 12.5,
          borderBottom: t.a ? '2px solid var(--ink)' : '2px solid transparent',
          color: t.a ? 'var(--ink)' : 'var(--ink-3)', fontWeight: t.a ? 500 : 400,
          marginBottom: -1,
        }}>{t.l}</div>
      ))}
      <div style={{ flex: 1, borderBottom: '1px solid var(--hair)', alignSelf: 'stretch' }} />
    </div>

    <div style={{ padding: '16px 32px 32px', overflow: 'auto' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}><div style={{ width: 14, height: 14, border: '1.5px solid var(--hair-strong)', borderRadius: 4 }} /></th>
              <th style={{ width: 50 }}>Nr</th>
              <th style={{ width: 90 }}>Datum</th>
              <th>Buchungstext</th>
              <th style={{ width: 180 }}>Soll</th>
              <th style={{ width: 180 }}>Haben</th>
              <th style={{ width: 100 }}>Quelle</th>
              <th style={{ width: 90 }}>KI</th>
              <th style={{ width: 120, textAlign: 'right' }}>Betrag CHF</th>
            </tr>
          </thead>
          <tbody>
            {[
              { n: 241, d: '23.04.26', txt: 'Swisscom · Telefonabo April', s: '6510 Telekom', h: '2000 Kreditoren', src: 'Beleg', c: 97, a: '132.19' },
              { n: 242, d: '23.04.26', txt: 'Swisscom · Vorsteuer 8.1%', s: '1171 Vorsteuer', h: '2000 Kreditoren', src: 'Beleg', c: 97, a: '10.71' },
              { n: 243, d: '22.04.26', txt: 'Google Workspace · April', s: '6540 IT-Dienst.', h: '2000 Kreditoren', src: 'Beleg', c: 99, a: '84.00' },
              { n: 244, d: '22.04.26', txt: 'Honorar Hofer Architekten R-0097', s: '1100 Debitoren', h: '3200 Dienstl.', src: 'Rechn.', c: 100, a: '4’280.00', pos: true },
              { n: 245, d: '22.04.26', txt: 'Amazon EU · Bürostuhl', s: '6570 Büromat.', h: '2000 Kreditoren', src: 'Bank', c: 62, a: '412.50', warn: 'MWST unklar' },
              { n: 246, d: '21.04.26', txt: 'ZKB Kontogebühr April', s: '6800 Bankspesen', h: '1020 ZKB', src: 'Bank', c: 100, a: '18.50' },
              { n: 247, d: '20.04.26', txt: 'Lohn Leonie Keller · April', s: '5000 Löhne', h: '1020 ZKB', src: 'Lohn', c: 100, a: '5’840.00' },
              { n: 248, d: '20.04.26', txt: 'Bewirtung Kunde · Coop', s: '6580 Repr. (50%)', h: '2100 Kreditkarte', src: 'KK', c: 72, a: '118.40', warn: 'Kunde fehlt' },
              { n: 249, d: '19.04.26', txt: 'SBB · Geschäftsreise Bern', s: '6220 Reisekosten', h: '2100 Kreditkarte', src: 'KK', c: 91, a: '295.00' },
              { n: 250, d: '18.04.26', txt: 'Migros · Büromaterial', s: '6570 Büromat.', h: '2100 Kreditkarte', src: 'KK', c: 84, a: '64.20' },
              { n: 251, d: '18.04.26', txt: 'IWB · Strom Q1', s: '6400 Energie', h: '2000 Kreditoren', src: 'Beleg', c: 96, a: '612.80' },
              { n: 252, d: '17.04.26', txt: 'Helvetia Betriebshaftpflicht', s: '6700 Versich.', h: '2000 Kreditoren', src: 'Beleg', c: 98, a: '842.00' },
            ].map((r, i) => (
              <tr key={i} style={r.warn ? { background: 'var(--warn-soft)' } : {}}>
                <td><div style={{ width: 14, height: 14, border: '1.5px solid var(--hair-strong)', borderRadius: 4, background: i < 4 ? 'var(--accent)' : 'transparent', borderColor: i < 4 ? 'var(--accent)' : 'var(--hair-strong)' }} /></td>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>#{r.n}</td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.d}</td>
                <td>
                  <div style={{ fontSize: 13 }}>{r.txt}</div>
                  {r.warn && <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="warn" size={10} />{r.warn}
                  </div>}
                </td>
                <td style={{ fontSize: 12 }}>{r.s}</td>
                <td style={{ fontSize: 12 }}>{r.h}</td>
                <td><Pill>{r.src}</Pill></td>
                <td><Conf value={r.c} /></td>
                <td className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: r.pos ? 'var(--pos)' : 'var(--ink)' }}>
                  {r.pos && '+'}{r.a}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit trail preview */}
      <div className="card card--soft" style={{ padding: 16, marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="check" size={16} style={{ color: 'var(--pos)' }} />
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)' }}>
          Beim Freigeben wird jede Buchung mit Zeitstempel, Anwender und KI-Version in der Prüfspur festgehalten (OR 957).
        </div>
        <Btn variant="ghost" size="sm">Audit-Log öffnen</Btn>
      </div>
    </div>
  </Frame>
);

Object.assign(window, { PageBelegeListe, PageBelegDetail, PageBank, PageFreigaben });
