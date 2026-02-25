'use client';

interface FeedbackPanelProps {
  message: string;
  dominantMechanism?: string;
  debugDrivers: {
    dSVR: number;
    dPVR: number;
    dVR: number;
    dContractility: number;
    dShunt: number;
  };
  hiddenSnapshot?: {
    extractionEfficiency: number;
    capillaryLeak: number;
    mito: number;
    catecholSensitivity: number;
  };
}

export function FeedbackPanel({ message, dominantMechanism, debugDrivers, hiddenSnapshot }: FeedbackPanelProps) {
  const isDev = process.env.NODE_ENV === 'development';
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <section
      style={{
        background: 'linear-gradient(180deg, rgba(16,26,43,0.82) 0%, rgba(12,20,34,0.78) 100%)',
        border: '1px solid var(--panel-border)',
        borderRadius: 'var(--radius)',
        padding: '16px 16px',
        display: 'grid',
        gap: 10,
        minHeight: 170,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.2)'
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, color: 'var(--muted)' }}>Feedback fisiologico</h3>

      <div style={{ display: 'grid', gap: 6 }}>
        {lines.map((line, index) => {
          const delimiterAt = line.indexOf(':');
          const title = delimiterAt > 0 ? line.slice(0, delimiterAt + 1) : 'ANALISE:';
          const body = delimiterAt > 0 ? line.slice(delimiterAt + 1).trim() : line;

          return (
            <article
              key={`${title}_${index}`}
              style={{
                border: '1px solid rgba(50,78,115,0.5)',
                background: 'linear-gradient(180deg, rgba(8,16,28,0.7) 0%, rgba(6,12,22,0.6) 100%)',
                borderRadius: 'var(--radius-sm)',
                padding: '9px 11px',
                display: 'grid',
                gap: 4,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
              }}
            >
              <strong style={{ color: 'var(--accent)', fontSize: 11.5, letterSpacing: 0.35 }}>{title}</strong>
              <span style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.35 }}>{body}</span>
            </article>
          );
        })}
      </div>

      {isDev && dominantMechanism ? (
        <p style={{ margin: 0, color: 'var(--accent)', lineHeight: 1.4, fontSize: 12.5 }}>{dominantMechanism}</p>
      ) : null}

      {isDev ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--muted)', fontSize: 12 }}>
          <span>drivers dSVR: {debugDrivers.dSVR.toFixed(1)}</span>
          <span>dPVR: {debugDrivers.dPVR.toFixed(1)}</span>
          <span>dVR: {debugDrivers.dVR.toFixed(2)}</span>
          <span>dContract: {debugDrivers.dContractility.toFixed(3)}</span>
          <span>dShunt: {debugDrivers.dShunt.toFixed(3)}</span>
        </div>
      ) : null}

      {isDev && hiddenSnapshot ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--muted)', fontSize: 12 }}>
          <span>ExtractionEff: {hiddenSnapshot.extractionEfficiency.toFixed(2)}</span>
          <span>Leak: {hiddenSnapshot.capillaryLeak.toFixed(2)}</span>
          <span>MitoDysf: {hiddenSnapshot.mito.toFixed(2)}</span>
          <span>CatecholSens: {hiddenSnapshot.catecholSensitivity.toFixed(2)}</span>
        </div>
      ) : null}
    </section>
  );
}
