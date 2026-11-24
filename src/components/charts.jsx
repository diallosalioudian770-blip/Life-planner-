import { useState } from 'react';

// Small dependency-free SVG charts. Two-series charts always use the same pair:
// "prévu" in a recessive neutral and "réalisé" in the primary ink, with a legend.

function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div style={{ position: 'absolute', left: tip.x, top: tip.y, transform: 'translate(-50%, -110%)', background: 'var(--navy)', color: '#F1E8DC', padding: '6px 10px', borderRadius: 8, fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5 }}>
      {tip.text}
    </div>
  );
}

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

// groups: [{label, a (prévu), b (réalisé)}]
export function PlanActualChart({ groups, format = (v) => v, height = 200, labels = ['Prévu', 'Réalisé'] }) {
  const [tip, setTip] = useState(null);
  const W = Math.max(320, groups.length * 64);
  const H = height;
  const pad = { l: 34, r: 8, t: 10, b: 34 };
  const max = niceMax(Math.max(1, ...groups.flatMap((g) => [g.a, g.b])));
  const gw = (W - pad.l - pad.r) / Math.max(1, groups.length);
  const bw = Math.min(18, gw / 3);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, max / 2, max];
  return (
    <div>
      <div className="legend mb" style={{ marginBottom: 8 }}>
        <span><i className="dot" style={{ background: 'var(--surface-3)', border: '1px solid var(--muted)' }} />{labels[0]}</span>
        <span><i className="dot" style={{ background: 'var(--primary)' }} />{labels[1]}</span>
      </div>
      <div style={{ position: 'relative', overflowX: 'auto' }} onMouseLeave={() => setTip(null)}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 520) }} role="img" aria-label="Graphique prévu et réalisé">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? '3 4' : ''} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
            </g>
          ))}
          {groups.map((g, i) => {
            const cx = pad.l + gw * i + gw / 2;
            return (
              <g key={i}>
                {[['a', 'var(--surface-3)', -1], ['b', 'var(--primary)', 1]].map(([k, c, side]) => {
                  const v = g[k] || 0;
                  const x = cx + (side < 0 ? -bw - 1 : 1);
                  const h = Math.max(0, y(0) - y(v));
                  return (
                    <g key={k}>
                      <rect x={x} y={y(v)} width={bw} height={h} rx={Math.min(4, h / 2)} fill={c} stroke={k === 'a' ? 'var(--muted)' : 'none'} strokeOpacity={0.35} />
                      <rect x={x - 3} y={pad.t} width={bw + 6} height={H - pad.t - pad.b} fill="transparent"
                        onMouseMove={(e) => { const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: `${g.label} · ${labels[k === 'a' ? 0 : 1]} : ${format(v)}` }); }} />
                    </g>
                  );
                })}
                <text x={cx} y={H - pad.b + 16} textAnchor="middle">{g.label.length > 10 ? g.label.slice(0, 9) + '…' : g.label}</text>
              </g>
            );
          })}
        </svg>
        <Tip tip={tip} />
      </div>
    </div>
  );
}

// single series vertical bars: [{label, value}]
export function Bars({ data, format = (v) => v, height = 160, color = 'var(--primary)', name = 'Valeur' }) {
  const [tip, setTip] = useState(null);
  const W = Math.max(300, data.length * 40);
  const H = height;
  const pad = { l: 34, r: 6, t: 10, b: 28 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const gw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(26, gw * 0.6);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <div style={{ position: 'relative', overflowX: 'auto' }} onMouseLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={name}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? '3 4' : ''} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + gw * i + gw / 2;
          const h = Math.max(0, y(0) - y(d.value));
          return (
            <g key={i}>
              <rect x={cx - bw / 2} y={y(d.value)} width={bw} height={h} rx={Math.min(4, h / 2)} fill={d.color || color} />
              <rect x={cx - gw / 2} y={pad.t} width={gw} height={H - pad.t - pad.b} fill="transparent"
                onMouseMove={(e) => { const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: `${d.label} : ${format(d.value)}` }); }} />
              <text x={cx} y={H - pad.b + 16} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

// horizontal bars with labels and values in text ink: [{label, value, color}]
export function HBars({ data, format = (v) => v, max: forcedMax }) {
  const max = forcedMax || Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="stack-sm">
      {data.map((d) => (
        <div key={d.label} title={`${d.label} : ${format(d.value)}`}>
          <div className="row between small"><span className="row" style={{ gap: 6 }}>{d.color && <i className="dot" style={{ background: d.color }} />}{d.label}</span><span className="muted">{format(d.value)}{d.extra ? ` ${d.extra}` : ''}</span></div>
          <div className="progress" style={{ height: 7 }}><div style={{ width: `${Math.min(100, (d.value / max) * 100)}%`, background: d.barColor || 'var(--gold)' }} /></div>
        </div>
      ))}
    </div>
  );
}

// line over time: [{label, value}]
export function Line({ data, format = (v) => v, height = 150, name = 'Évolution' }) {
  const [hover, setHover] = useState(null);
  const W = 520, H = height, pad = { l: 34, r: 10, t: 12, b: 26 };
  const vals = data.map((d) => d.value).filter((v) => v != null);
  const max = niceMax(Math.max(1, ...vals));
  const x = (i) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, data.length - 1);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const pts = data.map((d, i) => (d.value == null ? null : [x(i), y(d.value)])).filter(Boolean);
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={name}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1)); if (i >= 0 && i < data.length) setHover(i); }}>
        {[0, max / 2, max].map((t) => (
          <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? '3 4' : ''} /><text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>
        ))}
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" />)}
        {data.map((d, i) => (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{d.label}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeDasharray="2 3" />}
      </svg>
      {hover != null && data[hover] && (
        <div style={{ position: 'absolute', left: `${(x(hover) / W) * 100}%`, top: 0, transform: 'translateX(-50%)', background: 'var(--navy)', color: '#F1E8DC', padding: '4px 8px', borderRadius: 8, fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {data[hover].label} : {data[hover].value == null ? '—' : format(data[hover].value)}
        </div>
      )}
    </div>
  );
}
