'use client';

interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, color = '#46c2ff', width = 180, height = 48 }: SparklineProps) {
  if (!values.length) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.0001);

  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg width={width} height={height} role="img" aria-label="Trend sparkline" style={{ filter: 'drop-shadow(0 0 3px rgba(70,194,255,0.15))' }}>
      <defs>
        <linearGradient id={`sparkFill_${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#sparkFill_${color.replace(/[^a-zA-Z0-9]/g, '')})`}
        points={`0,${height} ${points.join(' ')} ${width},${height}`}
      />
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points.join(' ')} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
