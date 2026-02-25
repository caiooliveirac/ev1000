'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { caseOptions } from '@/cases';
import { BodyDiagram } from '@/ui/BodyDiagram';
import { ControlPanel } from '@/ui/ControlPanel';
import { FeedbackPanel } from '@/ui/FeedbackPanel';
import { MetricCard } from '@/ui/MetricCard';
import { Sparkline } from '@/ui/Sparkline';
import { useSimulationStore } from '@/ui/store';
import { deriveDisplayVarsFromPatient, displayVarRanges, DisplayRangeKey } from '@/sim/displayVars';
import { buildDerivedHistory, buildSeriesByMetric, monitorMetricKeys, monitorSections } from '@/ui/monitorSchema';

const statusByRange = (
  value: number,
  lowWarn: number,
  highWarn: number,
  lowCritical: number,
  highCritical: number
): 'normal' | 'warning' | 'critical' => {
  if (value < lowCritical || value > highCritical) {
    return 'critical';
  }
  if (value < lowWarn || value > highWarn) {
    return 'warning';
  }
  return 'normal';
};

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const goalColor: Record<string, string> = {
  on_target: 'var(--ok)',
  watch: 'var(--warn)',
  off_target: 'var(--critical)'
};

const statusFor = (key: DisplayRangeKey, value: number): 'normal' | 'warning' | 'critical' => {
  const range = displayVarRanges[key];
  return statusByRange(value, range.lowWarn, range.highWarn, range.lowCritical, range.highCritical);
};

const formatMetricValue = (value: number, decimals: number): string => value.toFixed(decimals);

type DensityMode = 'essential' | 'full';

const controlLabelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: 'var(--muted)',
  fontSize: 12
};

const selectInputStyle: CSSProperties = {
  background: 'rgba(15,24,40,0.85)',
  color: 'var(--text)',
  border: '1px solid rgba(40,64,97,0.5)',
  borderRadius: 8,
  padding: '7px 10px',
  backdropFilter: 'blur(4px)'
};

const chipButtonStyle: CSSProperties = {
  border: '1px solid rgba(54,87,134,0.45)',
  borderRadius: 8,
  color: 'var(--text)',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 500,
  letterSpacing: 0.2,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
};

const timelineKindLabel: Record<'intervention' | 'system' | 'adverse', string> = {
  intervention: 'Intervencao',
  system: 'Sistema',
  adverse: 'Adverso'
};

const timelineKindStyle: Record<'intervention' | 'system' | 'adverse', CSSProperties> = {
  intervention: { color: 'var(--accent)', borderColor: 'rgba(70,194,255,0.45)' },
  system: { color: 'var(--muted)', borderColor: 'rgba(157,176,204,0.35)' },
  adverse: { color: 'var(--critical)', borderColor: 'rgba(247,118,109,0.45)' }
};

const essentialMetricKeys = new Set([
  'map',
  'co',
  'hr',
  'svr',
  'cvp',
  'gedi',
  'evlw',
  'svo2',
  'lactate',
  'do2',
  'pao2',
  'ph'
]);

export function Monitor() {
  const {
    sim,
    tick,
    running,
    toggleRunning,
    reset,
    seed,
    setSeed,
    caseId,
    setCaseId,
    trendWindowSec,
    setTrendWindow,
    setNorepinephrineRate,
    setDobutamineRate,
    setVasopressinRate,
    giveFluidBolus,
    giveTransfusion,
    setFio2,
    setPeep,
    setVt
  } = useSimulationStore();
  const [densityMode, setDensityMode] = useState<DensityMode>('essential');

  useEffect(() => {
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [tick]);

  const history = sim.history;
  const cutoffSec = Math.max(0, sim.patient.timeSec - trendWindowSec);
  const scopedHistory = useMemo(
    () => history.filter((point) => point.timeSec >= cutoffSec),
    [history, cutoffSec]
  );
  const displayedSections = useMemo(() => {
    if (densityMode === 'full') {
      return monitorSections;
    }
    return monitorSections
      .map((section) => ({
        ...section,
        metrics: section.metrics.filter((metric) => essentialMetricKeys.has(metric.key))
      }))
      .filter((section) => section.metrics.length > 0);
  }, [densityMode]);
  const displayedMetricKeys = useMemo(
    () => displayedSections.flatMap((section) => section.metrics.map((metric) => metric.key)),
    [displayedSections]
  );
  const derivedHistory = useMemo(() => buildDerivedHistory(scopedHistory), [scopedHistory]);
  const trendSeriesByKey = useMemo(
    () => buildSeriesByMetric(derivedHistory, densityMode === 'full' ? monitorMetricKeys : displayedMetricKeys),
    [derivedHistory, densityMode, displayedMetricKeys]
  );
  const current = useMemo(() => deriveDisplayVarsFromPatient(sim.patient), [sim.patient]);

  return (
    <main className="monitor-main">
      <header
        style={{
          background: 'linear-gradient(180deg, rgba(16,26,43,0.88) 0%, rgba(11,18,32,0.85) 100%)',
          border: '1px solid var(--panel-border)',
          borderRadius: 'var(--radius)',
          padding: '14px 14px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'grid',
          gap: 10
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 18, letterSpacing: 1.2, fontWeight: 700, background: 'linear-gradient(135deg, #e8edf7 0%, #46c2ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Hemodynamic Monitor</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 11.5 }}>
            {sim.patient.caseName} | t={Math.round(sim.patient.timeSec)}s | seed={sim.patient.seed}
          </p>
        </div>
        <div className="monitor-header-controls">
          <label style={controlLabelStyle}>
            Caso
            <select
              value={caseId}
              onChange={(event) => setCaseId(event.target.value)}
              style={{ width: '100%', minWidth: 140, maxWidth: 220, ...selectInputStyle }}
            >
              {caseOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </label>

          <label style={controlLabelStyle}>
            Seed
            <input
              type="number"
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value || 0))}
              style={{ width: 90, ...selectInputStyle }}
            />
          </label>

          <div style={controlLabelStyle}>
            <span>Trend</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {([600, 3600, 21600] as const).map((w) => (
                <button key={w} onClick={() => setTrendWindow(w)}
                  style={{
                    ...chipButtonStyle,
                    background: trendWindowSec === w ? 'linear-gradient(180deg, #38577f 0%, #2d4768 100%)' : 'rgba(26,44,73,0.7)',
                    padding: '5px 8px', fontSize: 11.5
                  }}>
                  {w === 600 ? '10m' : w === 3600 ? '1h' : '6h'}
                </button>
              ))}
            </div>
          </div>

          <div style={controlLabelStyle}>
            <span>Modo</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['essential', 'full'] as const).map((m) => (
                <button key={m} onClick={() => setDensityMode(m)}
                  style={{
                    ...chipButtonStyle,
                    background: densityMode === m ? 'linear-gradient(180deg, #38577f 0%, #2d4768 100%)' : 'rgba(26,44,73,0.7)',
                    padding: '5px 8px', fontSize: 11.5
                  }}>
                  {m === 'essential' ? 'Ess.' : 'Full'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <ControlPanel
        running={running}
        onToggleRunning={toggleRunning}
        onReset={reset}
        norepiRate={sim.patient.hidden.pendingNorepinephrineRate}
        dobutamineRate={sim.patient.hidden.pendingDobutamineRate}
        vasopressinRate={sim.patient.hidden.pendingVasopressinRate}
        fio2={sim.patient.hidden.ventilatorFio2Target}
        peep={sim.patient.hidden.ventilatorPeepTarget}
        vt={sim.patient.hidden.ventilatorVtTarget}
        onSetNorepi={setNorepinephrineRate}
        onSetDobutamine={setDobutamineRate}
        onSetVasopressin={setVasopressinRate}
        onSetFio2={setFio2}
        onSetPeep={setPeep}
        onSetVt={setVt}
        onBolus={giveFluidBolus}
        onTransfusion={giveTransfusion}
      />

      <section className="monitor-body">
        {/* Anatomical body diagram */}
        <BodyDiagram patient={sim.patient} style={{ maxWidth: '100%', margin: '0 auto' }} />

        {/* Metric cards */}
        <div style={{ display: 'grid', gap: 10 }}>
        {displayedSections.map((section) => (
          <article
            key={section.id}
            style={{
              background: 'linear-gradient(180deg, rgba(16,26,43,0.8) 0%, rgba(12,20,34,0.75) 100%)',
              border: '1px solid var(--panel-border)',
              borderRadius: 'var(--radius)',
              padding: '10px 10px',
              display: 'grid',
              gap: 8,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.2)'
            }}
          >
            <h3 style={{ margin: 0, fontSize: 12, color: 'var(--muted)', letterSpacing: 0.3 }}>{section.title}</h3>
            <div className="metric-grid">
              {section.metrics.map((metric) => {
                const currentValue = current[metric.key];
                const unitLabel = metric.unit ? `${metric.fullName} (${metric.unit})` : metric.fullName;
                return (
                  <MetricCard
                    key={metric.key}
                    label={metric.label}
                    value={formatMetricValue(currentValue, metric.decimals)}
                    unit={metric.unit}
                    tooltip={unitLabel}
                    size={metric.size}
                    trend={<Sparkline values={trendSeriesByKey[metric.key]} color={metric.color} />}
                    status={statusFor(metric.rangeKey, currentValue)}
                    cardStyle={metric.key === 'map' ? { gridColumn: 'span 2' } : undefined}
                  />
                );
              })}
            </div>
          </article>
        ))}
        </div>
      </section>

      <section className="monitor-bottom">
        <section
          style={{
            background: 'linear-gradient(180deg, rgba(16,26,43,0.82) 0%, rgba(12,20,34,0.78) 100%)',
            border: '1px solid var(--panel-border)',
            borderRadius: 'var(--radius)',
            padding: 14,
            display: 'grid',
            gap: 8,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as const, color: 'var(--muted)' }}>Metas clinicas</h3>
          {sim.goals.map((goal) => (
            <article
              key={goal.id}
              style={{
                border: '1px solid rgba(45,71,106,0.5)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 11px',
                display: 'grid',
                gap: 5,
                background: 'linear-gradient(180deg, rgba(15,29,49,0.9) 0%, rgba(11,21,38,0.85) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>{goal.label}</strong>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: goalColor[goal.level]
                  }}
                />
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Alvo: {goal.target}</span>
              <span style={{ fontSize: 13 }}>Atual: {goal.current}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{goal.reason}</span>
            </article>
          ))}
        </section>

        <section
          style={{
            background: 'linear-gradient(180deg, rgba(16,26,43,0.82) 0%, rgba(12,20,34,0.78) 100%)',
            border: '1px solid var(--panel-border)',
            borderRadius: 'var(--radius)',
            padding: 14,
            display: 'grid',
            gap: 8,
            maxHeight: 280,
            overflowY: 'auto',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as const, color: 'var(--muted)' }}>Timeline de condutas</h3>
          {[...sim.timeline].reverse().slice(0, 30).map((entry) => (
            <article
              key={entry.id}
              style={{
                border: '1px solid rgba(50,78,115,0.5)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px',
                display: 'grid',
                gap: 4,
                background: 'linear-gradient(180deg, rgba(8,16,28,0.6) 0%, rgba(6,12,22,0.5) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(entry.timeSec)}
                </span>
                <span
                  style={{
                    ...timelineKindStyle[entry.kind],
                    fontSize: 10.5,
                    border: `1px solid ${timelineKindStyle[entry.kind].borderColor}`,
                    borderRadius: 999,
                    padding: '1px 7px',
                    letterSpacing: 0.25
                  }}
                >
                  {timelineKindLabel[entry.kind]}
                </span>
              </div>
              <span style={{ fontSize: 12.5, lineHeight: 1.35 }}>{entry.message}</span>
            </article>
          ))}
        </section>
      </section>

      <FeedbackPanel
        message={sim.feedback}
        dominantMechanism={sim.dominantMechanism}
        debugDrivers={sim.debugDrivers}
        hiddenSnapshot={{
          extractionEfficiency: sim.patient.hidden.extractionEfficiency,
          capillaryLeak: sim.patient.hidden.capillaryLeak,
          mito: sim.patient.hidden.mitochondrialDysfunction,
          catecholSensitivity: sim.patient.hidden.catecholamineSensitivity
        }}
      />
    </main>
  );
}
