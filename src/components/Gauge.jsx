// Circular arc gauge rendered in pure SVG
export default function Gauge({ value, min, max, color, label, unit, size = 140 }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const R   = 52;
  const cx  = size / 2;
  const cy  = size / 2 + 10;
  const startAngle = -210;
  const sweepAngle = 240;

  function polarToXY(angleDeg, r) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(startDeg, endDeg, r) {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg,   r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackStart  = startAngle;
  const trackEnd    = startAngle + sweepAngle;
  const fillEnd     = startAngle + sweepAngle * pct;

  // Needle tip
  const needleTip = polarToXY(fillEnd, R - 10);

  return (
    <div className="gauge-wrap">
      <svg width={size} height={size - 10} className="gauge-svg">
        {/* Track */}
        <path
          d={arcPath(trackStart, trackEnd, R)}
          fill="none" stroke="#1e2d40" strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Glow filter */}
        <defs>
          <filter id={`gf-${label}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Fill arc */}
        {pct > 0.01 && (
          <path
            d={arcPath(trackStart, fillEnd, R)}
            fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round"
            filter={`url(#gf-${label})`}
            style={{ transition: 'all 0.6s cubic-bezier(.16,1,.3,1)' }}
          />
        )}
        {/* Needle dot */}
        <circle cx={needleTip.x} cy={needleTip.y} r="4" fill={color}
          style={{ transition: 'all 0.6s cubic-bezier(.16,1,.3,1)' }}
        />
        {/* Center value */}
        <text x={cx} y={cy + 4} textAnchor="middle"
          fontSize="17" fontWeight="700" fontFamily="JetBrains Mono"
          fill={color}>{value.toFixed(1)}</text>
        <text x={cx} y={cy + 18} textAnchor="middle"
          fontSize="10" fill="#8b9fc0">{unit}</text>
        {/* Min / Max */}
        <text x={polarToXY(trackStart, R + 14).x} y={polarToXY(trackStart, R + 14).y}
          textAnchor="middle" fontSize="9" fill="#4a5568">{min}</text>
        <text x={polarToXY(trackEnd, R + 14).x} y={polarToXY(trackEnd, R + 14).y}
          textAnchor="middle" fontSize="9" fill="#4a5568">{max}</text>
      </svg>
      <span style={{ fontSize: 11, color: '#8b9fc0', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}
