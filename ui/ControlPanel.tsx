'use client';

import { useEffect, useState } from 'react';

interface ControlPanelProps {
  running: boolean;
  onToggleRunning: () => void;
  onReset: () => void;

  norepiRate: number;
  dobutamineRate: number;
  vasopressinRate: number;
  fio2: number;
  peep: number;
  vt: number;

  onSetNorepi: (value: number) => void;
  onSetDobutamine: (value: number) => void;
  onSetVasopressin: (value: number) => void;
  onSetFio2: (value: number) => void;
  onSetPeep: (value: number) => void;
  onSetVt: (value: number) => void;

  onBolus: (volumeMl: number) => void;
  onTransfusion: (units: number, targetHb?: number) => void;
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid rgba(45,71,106,0.45)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px 14px',
  display: 'grid',
  gap: 12,
  background: 'linear-gradient(180deg, rgba(15,29,49,0.92) 0%, rgba(11,21,38,0.88) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 12px rgba(0,0,0,0.15)'
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  color: 'var(--muted)',
  opacity: 0.85
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(11,21,38,0.8)',
  color: 'var(--text)',
  border: '1px solid rgba(54,87,134,0.5)',
  borderRadius: 8,
  padding: '7px 10px',
  backdropFilter: 'blur(4px)'
};

const rangeInputStyle: React.CSSProperties = {
  width: '100%',
  accentColor: 'var(--accent)',
  cursor: 'pointer'
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(54,87,134,0.5)',
  borderRadius: 8,
  background: 'linear-gradient(180deg, rgba(26,44,73,0.9) 0%, rgba(20,36,60,0.85) 100%)',
  color: 'var(--text)',
  padding: '7px 12px',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
};

const subtleTextStyle: React.CSSProperties = {
  color: 'var(--muted)',
  fontSize: 11
};

const parseNumeric = (raw: string, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

interface DosingRowProps {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  onApply: () => void;
}

function DosingRow({ label, hint, min, max, step, value, onChange, onApply }: DosingRowProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <div style={{ minWidth: 150, flex: '1 1 180px' }}>
        <div style={{ fontSize: 12 }}>{label}</div>
        <div style={subtleTextStyle}>{hint}</div>
      </div>
      <div style={{ minWidth: 180, flex: '1 1 220px' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(parseNumeric(event.target.value, value))}
          style={rangeInputStyle}
        />
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseNumeric(event.target.value, value))}
        style={{ ...inputStyle, width: 90 }}
      />
      <button onClick={onApply} style={{ ...buttonStyle, minWidth: 110 }}>
        Aplicar
      </button>
    </div>
  );
}

export function ControlPanel({
  running,
  onToggleRunning,
  onReset,
  norepiRate,
  dobutamineRate,
  vasopressinRate,
  fio2,
  peep,
  vt,
  onSetNorepi,
  onSetDobutamine,
  onSetVasopressin,
  onSetFio2,
  onSetPeep,
  onSetVt,
  onBolus,
  onTransfusion
}: ControlPanelProps) {
  const [norepiInput, setNorepiInput] = useState(norepiRate);
  const [dobutamineInput, setDobutamineInput] = useState(dobutamineRate);
  const [vasopressinInput, setVasopressinInput] = useState(vasopressinRate);
  const [fio2Input, setFio2Input] = useState(fio2);
  const [peepInput, setPeepInput] = useState(peep);
  const [vtInput, setVtInput] = useState(vt);
  const [targetHbInput, setTargetHbInput] = useState(8);

  useEffect(() => {
    setNorepiInput(norepiRate);
    setDobutamineInput(dobutamineRate);
    setVasopressinInput(vasopressinRate);
    setFio2Input(fio2);
    setPeepInput(peep);
    setVtInput(vt);
  }, [norepiRate, dobutamineRate, vasopressinRate, fio2, peep, vt]);

  return (
    <section
      style={{
        background: 'linear-gradient(180deg, rgba(16,26,43,0.82) 0%, rgba(12,20,34,0.78) 100%)',
        border: '1px solid var(--panel-border)',
        borderRadius: 'var(--radius)',
        padding: '16px 16px',
        display: 'grid',
        gap: 12,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.2)'
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onToggleRunning}
          style={{
            ...buttonStyle,
            background: running
              ? 'linear-gradient(180deg, #3b5442 0%, #2d4435 100%)'
              : 'linear-gradient(180deg, #5d3b3b 0%, #4a2f2f 100%)',
            fontWeight: 600,
            letterSpacing: 0.3
          }}
        >
          {running ? '⏸ Pausar' : '▶ Continuar'}
        </button>
        <button onClick={onReset} style={{ ...buttonStyle, background: 'linear-gradient(180deg, #2f3753 0%, #252d44 100%)' }}>
          Reiniciar caso
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Infusoes vasoativas</h4>

          <div style={{ display: 'grid', gap: 8 }}>
            <DosingRow
              label="Noradrenalina"
              hint="mcg/kg/min • 0 a 3"
              min={0}
              max={3}
              step={0.01}
              value={norepiInput}
              onChange={setNorepiInput}
              onApply={() => onSetNorepi(norepiInput)}
            />

            <DosingRow
              label="Dobutamina"
              hint="mcg/kg/min • 0 a 20"
              min={0}
              max={20}
              step={0.5}
              value={dobutamineInput}
              onChange={setDobutamineInput}
              onApply={() => onSetDobutamine(dobutamineInput)}
            />

            <DosingRow
              label="Vasopressina"
              hint="U/min • 0 a 0.06"
              min={0}
              max={0.06}
              step={0.001}
              value={vasopressinInput}
              onChange={setVasopressinInput}
              onApply={() => onSetVasopressin(vasopressinInput)}
            />
          </div>
        </div>

        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Fluido e transfusao</h4>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={subtleTextStyle}>Bolus cristaloide</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onBolus(250)} style={buttonStyle}>
                250 mL
              </button>
              <button onClick={() => onBolus(500)} style={buttonStyle}>
                500 mL
              </button>
              <button onClick={() => onBolus(1000)} style={buttonStyle}>
                1000 mL
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={subtleTextStyle}>Transfusao</div>
            <label style={{ fontSize: 12, color: 'var(--muted)' }}>
              Alvo Hb (g/dL)
              <input
                type="number"
                min={6}
                max={12}
                step={0.1}
                value={targetHbInput}
                onChange={(event) => setTargetHbInput(parseNumeric(event.target.value, targetHbInput))}
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onTransfusion(1, targetHbInput)} style={buttonStyle}>
                1U
              </button>
              <button onClick={() => onTransfusion(2, targetHbInput)} style={buttonStyle}>
                2U
              </button>
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Ventilacao mecanica</h4>

          <div style={{ display: 'grid', gap: 8 }}>
            <DosingRow
              label="FiO2"
              hint="Fracao inspirada • 0.21 a 1.0"
              min={0.21}
              max={1}
              step={0.01}
              value={fio2Input}
              onChange={setFio2Input}
              onApply={() => onSetFio2(fio2Input)}
            />

            <DosingRow
              label="PEEP"
              hint="cmH2O • 5 a 20"
              min={5}
              max={20}
              step={1}
              value={peepInput}
              onChange={setPeepInput}
              onApply={() => onSetPeep(peepInput)}
            />

            <DosingRow
              label="VT"
              hint="mL • 280 a 750"
              min={280}
              max={750}
              step={10}
              value={vtInput}
              onChange={setVtInput}
              onApply={() => onSetVt(vtInput)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
