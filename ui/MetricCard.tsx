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
  normal: 'rgba(90, 179, 119, 0.45)',
  warning: 'rgba(243, 171, 66, 0.5)',
  critical: 'rgba(236, 102, 96, 0.55)'
};

const statusGlow: Record<NonNullable<MetricCardProps['status']>, string> = {
  normal: 'rgba(90, 179, 119, 0.12)',
  warning: 'rgba(243, 171, 66, 0.14)',
  critical: 'rgba(236, 102, 96, 0.16)'
};

const valueSizeByCardSize: Record<NonNullable<MetricCardProps['size']>, number> = {
  primary: 40,
  secondary: 34,
  standard: 30,
  compact: 26
};

const minWidthByCardSize: Record<NonNullable<MetricCardProps['size']>, number> = {
  primary: 260,
  secondary: 235,
  standard: 220,
  compact: 190
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
          'linear-gradient(180deg, rgba(16,26,43,0.98) 0%, rgba(14,23,38,0.9) 100%), radial-gradient(120px 30px at 10% 0%, rgba(91,130,178,0.18), transparent 75%)',
        border: `1px solid ${statusBorder[status]}`,
        borderRadius: 12,
        padding: 11,
        minWidth: minWidthByCardSize[size],
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(20,33,53,0.25), 0 8px 20px ${statusGlow[status]}`,
        ...cardStyle
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 12.5, letterSpacing: 0.35 }} title={tooltip}>
          {label}
        </span>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: statusColor[status],
            boxShadow: `0 0 10px ${statusGlow[status]}`
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
