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
    <svg width={width} height={height} role="img" aria-label="Trend sparkline">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points.join(' ')} />
    </svg>
  );
}
