'use client';

import { CSSProperties, ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: ReactNode;
  status?: 'normal' | 'warning' | 'critical';
  tooltip?: string;
  size?: 'primary' | 'secondary' | 'standard' | 'compact';
  cardStyle?: CSSProperties;
}

const statusColor: Record<NonNullable<MetricCardProps['status']>, string> = {
  normal: 'var(--ok)',
  warning: 'var(--warn)',
  critical: 'var(--critical)'
};

const statusBorder: Record<NonNullable<MetricCardProps['status']>, string> = {
  normal: 'rgba(109, 227, 142, 0.35)',
  warning: 'rgba(248, 192, 95, 0.4)',
  critical: 'rgba(247, 118, 109, 0.45)'
};

const statusGlow: Record<NonNullable<MetricCardProps['status']>, string> = {
  normal: 'rgba(109, 227, 142, 0.08)',
  warning: 'rgba(248, 192, 95, 0.1)',
  critical: 'rgba(247, 118, 109, 0.12)'
};

const valueSizeByCardSize: Record<NonNullable<MetricCardProps['size']>, number> = {
  primary: 32,
  secondary: 28,
  standard: 24,
  compact: 20
};

export function MetricCard({
  label,
  value,
  unit,
  trend,
  status = 'normal',
  tooltip,
  size = 'standard',
  cardStyle
}: MetricCardProps) {
  return (
    <article
      style={{
        background:
          'linear-gradient(180deg, rgba(16,26,43,0.92) 0%, rgba(12,20,34,0.85) 100%)',
        border: `1px solid ${statusBorder[status]}`,
        borderRadius: 'var(--radius)',
        padding: '10px 11px',
        minWidth: 0,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(0,0,0,0.15), 0 8px 24px ${statusGlow[status]}`,
        transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
        ...cardStyle
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 12.5, letterSpacing: 0.35 }} title={tooltip}>
          {label}
        </span>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: statusColor[status],
            boxShadow: `0 0 8px ${statusGlow[status]}, 0 0 16px ${statusGlow[status]}`,
            transition: 'background 0.5s ease, box-shadow 0.5s ease'
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <strong
          style={{
            fontSize: valueSizeByCardSize[size],
            letterSpacing: 0.4,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 1px 0 rgba(0,0,0,0.35)'
          }}
        >
          {value}
        </strong>
        {unit ? <span style={{ color: 'var(--muted)', fontSize: 11.5, letterSpacing: 0.25 }}>{unit}</span> : null}
      </div>
      <div style={{ marginTop: 8, opacity: 0.95 }}>{trend}</div>
    </article>
  );
}
