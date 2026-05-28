import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = {
  solarV:  '#f59e0b',
  windV:   '#38bdf8',
  battV:   '#34d399',
  solarI:  '#fb923c',
  loadI:   '#a78bfa',
};

const LABELS = {
  solarV:  'Solar V',
  windV:   'Wind V',
  battV:   'Batt V',
  solarI:  'Solar A',
  loadI:   'Load A',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2d40',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 3 }}>
          <span style={{ color: '#8b9fc0' }}>{LABELS[p.dataKey]}: </span>
          <strong>{Number(p.value).toFixed(2)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function TrendChart({ history, keys = ['solarV', 'windV', 'battV'] }) {
  const chartData = history.map((h, i) => ({
    ...h,
    t: i,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {keys.map(k => (
            <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS[k]} stopOpacity={0.25}/>
              <stop offset="95%" stopColor={COLORS[k]} stopOpacity={0}/>
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#1e2d40" strokeDasharray="3 3" vertical={false}/>
        <XAxis dataKey="t" hide />
        <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {keys.map(k => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stroke={COLORS[k]}
            strokeWidth={2}
            fill={`url(#grad-${k})`}
            dot={false}
            activeDot={{ r: 4, fill: COLORS[k] }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { COLORS, LABELS };
