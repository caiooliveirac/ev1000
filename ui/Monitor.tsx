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
  background: '#0f1828',
  color: 'var(--text)',
  border: '1px solid var(--panel-border)',
  borderRadius: 8,
  padding: '6px 8px'
};

const chipButtonStyle: CSSProperties = {
  border: '1px solid #365786',
  borderRadius: 8,
  color: 'var(--text)',
  padding: '6px 8px',
  cursor: 'pointer'
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
    <main style={{ padding: 18, display: 'grid', gap: 14, maxWidth: 1680, margin: '0 auto' }}>
      <header
        style={{
          background: 'linear-gradient(180deg, rgba(16,26,43,0.96) 0%, rgba(11,20,36,0.92) 100%)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 14,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ minWidth: 280 }}>
          <h1 style={{ margin: 0, fontSize: 23, letterSpacing: 0.2 }}>Hemodynamic Monitor EV1000-like</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 12.5 }}>
            {sim.patient.caseName} | t={Math.round(sim.patient.timeSec)}s | seed={sim.patient.seed}
          </p>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                border: '1px solid rgba(70,194,255,0.35)',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
                color: 'var(--accent)'
              }}
            >
              Trend: {trendWindowSec === 600 ? '10 min' : trendWindowSec === 3600 ? '1 h' : '6 h'}
            </span>
            <span
              style={{
                border: '1px solid rgba(157,176,204,0.35)',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
                color: 'var(--muted)'
              }}
            >
              Modo: {densityMode === 'essential' ? 'Essencial' : 'Completo'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', flex: '1 1 680px' }}>
          <label style={controlLabelStyle}>
            Caso
            <select
              value={caseId}
              onChange={(event) => setCaseId(event.target.value)}
              style={{
                width: 220,
                ...selectInputStyle
              }}
            >
              {caseOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label style={controlLabelStyle}>
            Seed reproduzivel
            <input
              type="number"
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value || 0))}
              style={{
                width: 130,
                ...selectInputStyle
              }}
            />
          </label>

          <div style={controlLabelStyle}>
            <span>Zoom tendencia</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setTrendWindow(600)}
                style={{
                  ...chipButtonStyle,
                  background: trendWindowSec === 600 ? '#38577f' : '#1a2c49',
                  minWidth: 62
                }}
              >
                10 min
              </button>
              <button
                onClick={() => setTrendWindow(3600)}
                style={{
                  ...chipButtonStyle,
                  background: trendWindowSec === 3600 ? '#38577f' : '#1a2c49',
                  minWidth: 62
                }}
              >
                1 h
              </button>
              <button
                onClick={() => setTrendWindow(21600)}
                style={{
                  ...chipButtonStyle,
                  background: trendWindowSec === 21600 ? '#38577f' : '#1a2c49',
                  minWidth: 62
                }}
              >
                6 h
              </button>
            </div>
          </div>

          <div style={controlLabelStyle}>
            <span>Densidade do monitor</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setDensityMode('essential')}
                style={{
                  ...chipButtonStyle,
                  background: densityMode === 'essential' ? '#38577f' : '#1a2c49',
                  minWidth: 84
                }}
              >
                Essencial
              </button>
              <button
                onClick={() => setDensityMode('full')}
                style={{
                  ...chipButtonStyle,
                  background: densityMode === 'full' ? '#38577f' : '#1a2c49',
                  minWidth: 84
                }}
              >
                Completo
              </button>
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

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 420px) 1fr', gap: 14, alignItems: 'start' }}>
        {/* Anatomical body diagram */}
        <BodyDiagram patient={sim.patient} />

        {/* Metric cards */}
        <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ color: 'var(--muted)', fontSize: 12, letterSpacing: 0.2 }}>
          Modo {densityMode === 'essential' ? 'essencial' : 'completo'}: {displayedMetricKeys.length} variaveis
          visiveis.
        </div>
        {displayedSections.map((section) => (
          <article
            key={section.id}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 12,
              padding: 11,
              display: 'grid',
              gap: 9
            }}
          >
            <h3 style={{ margin: 0, fontSize: 13, color: 'var(--muted)', letterSpacing: 0.3 }}>{section.title}</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${section.columnsMinWidth}px, 1fr))`,
                gap: 10
              }}
            >
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

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 10
        }}
      >
        <section
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 12,
            display: 'grid',
            gap: 8
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>Metas clinicas</h3>
          {sim.goals.map((goal) => (
            <article
              key={goal.id}
              style={{
                border: '1px solid #2d476a',
                borderRadius: 8,
                padding: 8,
                display: 'grid',
                gap: 4,
                background: '#0f1d31'
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
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 12,
            display: 'grid',
            gap: 8,
            maxHeight: 260,
            overflowY: 'auto'
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>Timeline de condutas</h3>
          {[...sim.timeline].reverse().slice(0, 30).map((entry) => (
            <article
              key={entry.id}
              style={{
                border: '1px solid rgba(50,78,115,0.7)',
                borderRadius: 8,
                padding: '6px 8px',
                display: 'grid',
                gap: 4,
                background: 'rgba(8,16,28,0.45)'
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
