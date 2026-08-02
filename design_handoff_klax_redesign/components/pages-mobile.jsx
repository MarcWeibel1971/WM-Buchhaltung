/* global React, Icon, Pill, Btn, Conf, Sidebar */
// KLAX — Mobile screens, clickable Beleg-Flow prototype, Weibel-Müller Hi-Fi

const { useState } = React;

// ───── Mobile shell ─────
const Phone = ({ children, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24 }}>
    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
    <div style={{
      width: 390, height: 780, borderRadius: 46,
      background: '#1A1917', padding: 10,
      boxShadow: '0 30px 70px -30px rgba(23,20,15,.35), 0 2px 10px rgba(23,20,15,.1)'
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 38,
        background: 'var(--paper)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column'
      }} className="klax">
        {/* Status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px 6px', fontSize: 13, fontWeight: 600 }}>
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>●●●●</span>
        </div>
        {children}
      </div>
    </div>
  </div>
);

// Mobile — Inbox
const MobileInbox = () => (
  <Phone label="iPhone · Inbox">
    <div style={{ padding: '8px 20px 16px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'var(--accent)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17,
        }}>K</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Icon name="search" size={18} style={{ color: 'var(--ink-2)' }} />
          <Icon name="bell" size={18} style={{ color: 'var(--ink-2)' }} />
        </div>
      </div>

      <div>
        <div className="display" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Inbox</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>19 offen · Klax hat 11 erledigt</div>
      </div>

      {/* KI hero */}
      <div style={{
        padding: 14, borderRadius: 14,
        background: 'linear-gradient(180deg, var(--ai-soft), #FBFAF7)',
        border: '1px solid var(--ai-line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="sparkle" size={12} style={{ color: 'var(--ai)' }} />
          <span style={{ fontSize: 10.5, color: 'var(--ai)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Klax hat vorbereitet</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.45 }}>
          14 neue Belege · 12 bereit zur Freigabe, 2 brauchen deinen Blick.
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>Alle 12 prüfen →</button>
      </div>

      <div>
        <div className="label" style={{ marginBottom: 8 }}>Zu erledigen</div>
        {[
          { ic: 'file', c: 12, l: 'Zur Freigabe', t: 'accent' },
          { ic: 'bank', c: 3, l: 'Ungematchte Banktx', t: 'warn' },
          { ic: 'warn', c: 2, l: 'Mit Warnung', t: 'neg' },
          { ic: 'clock', c: 4, l: 'Fällige Rechnungen', t: 'info' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `var(--${k.t === 'accent' ? 'accent-soft' : k.t + '-soft'})`,
              color: `var(--${k.t === 'accent' ? 'accent' : k.t})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name={k.ic} size={16} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{k.l}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{k.c} Einträge</div>
            </div>
            <Icon name="chevR" size={14} style={{ color: 'var(--ink-4)' }} />
          </div>
        ))}
      </div>
    </div>

    {/* Bottom dock */}
    <div style={{
      display: 'flex', justifyContent: 'space-around',
      padding: '12px 20px 28px',
      borderTop: '1px solid var(--hair)', background: 'var(--surface)'
    }}>
      {[
        { ic: 'inbox', l: 'Inbox', a: true },
        { ic: 'file', l: 'Belege' },
        { ic: 'upload', l: '' },
        { ic: 'bank', l: 'Bank' },
        { ic: 'chart', l: 'Berichte' },
      ].map((t, i) => t.ic === 'upload' ? (
        <div key={i} style={{
          width: 46, height: 46, borderRadius: 14,
          background: 'var(--accent)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: -18, boxShadow: 'var(--shadow-2)'
        }}><Icon name="plus" size={20} stroke={2.2} /></div>
      ) : (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: t.a ? 'var(--ink)' : 'var(--ink-4)' }}>
          <Icon name={t.ic} size={18} />
          <span style={{ fontSize: 10 }}>{t.l}</span>
        </div>
      ))}
    </div>
  </Phone>
);

// Mobile — Beleg-Scan
const MobileScan = () => (
  <Phone label="iPhone · Beleg scannen">
    <div style={{ flex: 1, position: 'relative', background: '#0F0E0C', overflow: 'hidden' }}>
      {/* Camera viewfinder */}
      <div style={{
        position: 'absolute', inset: 60,
        border: '2px dashed rgba(255,255,255,0.35)',
        borderRadius: 12
      }}>
        {/* Corners */}
        {[[0,0],[1,0],[0,1],[1,1]].map(([x,y],i) => (
          <div key={i} style={{
            position: 'absolute',
            [x ? 'right' : 'left']: -1, [y ? 'bottom' : 'top']: -1,
            width: 24, height: 24,
            borderTop: y ? 'none' : '3px solid white',
            borderBottom: y ? '3px solid white' : 'none',
            borderLeft: x ? 'none' : '3px solid white',
            borderRight: x ? '3px solid white' : 'none',
            borderRadius: 4,
          }} />
        ))}
        {/* Mock receipt */}
        <div style={{
          position: 'absolute', inset: 20,
          background: 'white', borderRadius: 4, padding: 16,
          fontSize: 9, color: '#333', transform: 'rotate(-2deg)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>COOP</div>
          <div style={{ color: '#888', fontSize: 8, marginTop: 2 }}>Pronto Oerlikon · 20.04.26</div>
          <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kaffee</span><span>4.20</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sandwich</span><span>8.90</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mineral</span><span>3.30</span></div>
          <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Total</span><span>16.40</span></div>
        </div>
      </div>

      {/* KI scan-hint */}
      <div style={{
        position: 'absolute', top: 20, left: 20, right: 20,
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
        color: 'white', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center'
      }}>
        <Icon name="sparkle" size={13} style={{ color: '#C8BBE4' }} />
        <span>Klax erkennt: <b>Coop · CHF 16.40 · Bewirtung?</b></span>
      </div>

      {/* Bottom capture */}
      <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Icon name="file" size={18} />
        </div>
        <div style={{
          width: 72, height: 72, borderRadius: 999,
          background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 4px rgba(255,255,255,0.3)'
        }}>
          <div style={{ width: 58, height: 58, borderRadius: 999, background: 'white', border: '3px solid #1A1917' }} />
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Icon name="sparkle" size={18} />
        </div>
      </div>
    </div>
  </Phone>
);

// Mobile — Dashboard
const MobileDashboard = () => (
  <Phone label="iPhone · Dashboard">
    <div style={{ padding: '8px 20px 16px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Weibel-Müller AG</div>
          <div className="display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>Guten Morgen, Roger.</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 600 }}>WM</div>
      </div>

      {/* Finanzstatus card */}
      <div className="card" style={{ padding: 18, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }}>
        <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Liquidität</div>
        <div className="num display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 4 }}>CHF 284’520.40</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>+CHF 12’400 vs. Vormonat</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, opacity: 0.7 }}>Offene Ford.</div>
            <div className="num" style={{ fontSize: 15, fontWeight: 500 }}>48’210</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, opacity: 0.7 }}>Ergebnis YTD</div>
            <div className="num" style={{ fontSize: 15, fontWeight: 500 }}>+62’840</div>
          </div>
        </div>
      </div>

      {/* Heute */}
      <div>
        <div className="label" style={{ marginBottom: 8 }}>Heute zu erledigen</div>
        {[
          { ic: 'check', c: 12, l: 'Freigaben bereit', sub: 'Klax hat kontiert', t: 'accent' },
          { ic: 'bank', c: 3, l: 'Ungematchte Banktx', sub: 'ZKB', t: 'warn' },
          { ic: 'warn', c: 2, l: 'Belege mit Warnung', sub: 'MWST prüfen', t: 'neg' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `var(--${k.t === 'accent' ? 'accent-soft' : k.t + '-soft'})`,
              color: `var(--${k.t === 'accent' ? 'accent' : k.t})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name={k.ic} size={16} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{k.l}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{k.sub}</div>
            </div>
            <div className="num display" style={{ fontSize: 20, fontWeight: 500 }}>{k.c}</div>
          </div>
        ))}
      </div>

      {/* KI-Chip */}
      <div style={{
        padding: 12, borderRadius: 12, background: 'var(--ai-soft)',
        border: '1px solid var(--ai-line)', display: 'flex', gap: 10, alignItems: 'center'
      }}>
        <Icon name="sparkle" size={14} style={{ color: 'var(--ai)' }} />
        <div style={{ flex: 1, fontSize: 12, color: 'var(--ai)' }}>„Wie hoch ist mein Aufwand für IT-Abos?"</div>
        <Icon name="arrow" size={14} style={{ color: 'var(--ai)' }} />
      </div>
    </div>
  </Phone>
);

// ───── Clickable Beleg-Flow Prototype ─────
const FlowProto = () => {
  const [step, setStep] = useState(0);
  const steps = [
    { l: 'Upload', ic: 'upload' },
    { l: 'KI analysiert', ic: 'sparkle' },
    { l: 'Vorschlag', ic: 'bot' },
    { l: 'Match', ic: 'link' },
    { l: 'Freigegeben', ic: 'check' },
  ];

  return (
    <div className="klax" style={{ width: 1440, height: 900, display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
      {/* Stepper header */}
      <div style={{ padding: '28px 40px 20px', borderBottom: '1px solid var(--hair)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Klickbarer Prototyp</div>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>
              Vom Beleg zur Buchung — in 4 Klicks
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn--sm" onClick={() => setStep(Math.max(0, step - 1))}>← Zurück</button>
            <button className="btn btn--sm btn--primary" onClick={() => setStep(Math.min(4, step + 1))}>Weiter →</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div
                onClick={() => setStep(i)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  cursor: 'pointer', flexShrink: 0
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 999,
                  background: i < step ? 'var(--pos)' : i === step ? 'var(--accent)' : 'var(--surface)',
                  color: i <= step ? 'var(--accent-ink)' : 'var(--ink-3)',
                  border: i === step ? '3px solid var(--accent)' : '1px solid var(--hair)',
                  boxShadow: i === step ? '0 0 0 6px var(--accent-soft)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}>
                  {i < step ? <Icon name="check" size={15} stroke={2.2} /> : <Icon name={s.ic} size={14} />}
                </div>
                <div style={{ fontSize: 11, color: i === step ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i === step ? 500 : 400 }}>{s.l}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? 'var(--pos)' : 'var(--hair)', margin: '0 8px', marginBottom: 24 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Stage */}
      <div style={{ flex: 1, padding: 40, overflow: 'hidden' }}>
        {step === 0 && (
          <div style={{
            border: '2px dashed var(--accent-line)', borderRadius: 16,
            background: 'var(--accent-soft)', padding: 60, textAlign: 'center',
            height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: 'var(--accent)', color: 'var(--accent-ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="upload" size={30} stroke={1.8} />
            </div>
            <div className="display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>Beleg hier ablegen</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 480 }}>
              PDF, Foto, Screenshot oder E-Mail an <b style={{ color: 'var(--ink)' }}>invoices@weibel-mueller.klax.ch</b>. Klax analysiert automatisch.
            </div>
            <button className="btn btn--primary" onClick={() => setStep(1)}>Beispielbeleg hochladen</button>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', gap: 24, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: 320, height: 440, background: 'white', borderRadius: 8,
              boxShadow: 'var(--shadow-3)', padding: 24, fontSize: 10, color: '#333',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0058a3' }}>swisscom</div>
              <div style={{ color: '#888', marginTop: 4 }}>Rechnung R-0142 · 12.04.2026</div>
              <div style={{ height: 1, background: '#ddd', margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0' }}><span>Mobile Abo Plus</span><span>68.00</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0' }}><span>Internet Business</span><span>59.00</span></div>
              <div style={{ height: 1, background: '#333', margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}><span>Total</span><span>142.90</span></div>

              {/* OCR highlight sweep */}
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 40,
                background: 'linear-gradient(180deg, transparent, var(--ai) 50%, transparent)',
                opacity: 0.15, top: '40%', pointerEvents: 'none'
              }} />
            </div>

            <div style={{ flex: '0 0 440px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--ai-soft)', color: 'var(--ai)',
                  border: '1px solid var(--ai-line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><Icon name="sparkle" size={18} stroke={2} /></div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ai)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>Klax liest deinen Beleg</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>OCR · Lieferantenerkennung · Kategorisierung</div>
                </div>
              </div>
              {['Lieferant erkannt: Swisscom', 'Rechnungsnummer extrahiert: R-0142', 'Total CHF 142.90 (MWST 8.1%)', 'Historie gefunden: 11 vorherige Rechnungen', 'Regel: → 6510 Telekom'].map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'center', borderBottom: '1px solid var(--hair)' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--pos)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={11} stroke={2.4} />
                  </div>
                  <div style={{ fontSize: 13 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ maxWidth: 720, margin: '40px auto 0' }}>
            <div className="card" style={{ padding: 24, background: 'linear-gradient(180deg, #FBFAF7, var(--ai-soft))' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--ai-soft)', color: 'var(--ai)',
                  border: '1px solid var(--ai-line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}><Icon name="sparkle" size={18} stroke={2} /></div>
                <div style={{ flex: 1 }}>
                  <div className="display" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em' }}>
                    Ich würde das so buchen:
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Wiederkehrend wie R-0141 (März) · Confidence 97%</div>
                </div>
                <Conf value={97} />
              </div>

              <div className="card" style={{ padding: 16, background: 'white' }}>
                {[
                  ['Soll', '6510 Telekom-Gebühren', '132.19'],
                  ['Soll', '1171 Vorsteuer 8.1%', '10.71'],
                  ['Haben', '2000 Kreditoren Swisscom', '142.90'],
                ].map(([t, a, v]) => (
                  <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--hair)' }}>
                    <span style={{
                      width: 48, textAlign: 'center', fontSize: 10,
                      padding: '3px 0', borderRadius: 4,
                      background: t === 'Soll' ? 'var(--pos-soft)' : 'var(--neg-soft)',
                      color: t === 'Soll' ? 'var(--pos)' : 'var(--neg)',
                      fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase'
                    }}>{t}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{a}</span>
                    <span className="num" style={{ fontSize: 14, fontWeight: 500 }}>CHF {v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Konto ändern</button>
                <button className="btn btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Ablehnen</button>
                <button className="btn btn--sm btn--primary" onClick={() => setStep(3)} style={{ flex: 2, justifyContent: 'center' }}>
                  Annehmen & matchen
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ maxWidth: 880, margin: '40px auto 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <div className="display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>
                Ein passender Bankeintrag
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Klax hat die ZKB-Lastschrift vom 15.04. gefunden</div>
            </div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center' }}>
              <div className="card" style={{ padding: 18, width: 340 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Beleg</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Swisscom · R-0142</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>12.04.2026 · Telekom April</div>
                <div className="num display" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 10 }}>−CHF 142.90</div>
              </div>

              <div style={{
                width: 64, height: 64, borderRadius: 999,
                background: 'var(--pos)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 10px var(--pos-soft)'
              }}>
                <Icon name="link" size={26} stroke={2} />
              </div>

              <div className="card" style={{ padding: 18, width: 340 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Banktransaktion</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>ZKB Geschäftskonto</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>15.04.2026 · eBanking-Lastschrift</div>
                <div className="num display" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 10 }}>−CHF 142.90</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 30 }}>
              <button className="btn btn--primary" onClick={() => setStep(4)} style={{ padding: '12px 20px' }}>
                <Icon name="check" size={14} /> Freigeben & verbuchen
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 999,
              background: 'var(--pos)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 16px var(--pos-soft)'
            }}>
              <Icon name="check" size={42} stroke={2.2} />
            </div>
            <div className="display" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Freigegeben & verbucht</div>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 480 }}>
              Buchung #241/242 erstellt · Prüfspur protokolliert · Bank-Match R-0142 ↔ ZKB-Lastschrift vom 15.04.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn--sm" onClick={() => setStep(0)}>Nächster Beleg</button>
              <button className="btn btn--sm">Im Journal ansehen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { MobileInbox, MobileScan, MobileDashboard, FlowProto });
