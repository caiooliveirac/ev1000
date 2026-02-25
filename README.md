# Hemodynamic Simulator (Phase 2.1 + 3.0 Patch)

Educational EV1000-like simulator with a nonlinear cardio-pulmonary engine. This project does not copy proprietary Edwards algorithms or branded assets.

## Scope Of This Patch

- No major refactor and no visual redesign.
- Surgical motor updates for realism:
  - noradrenaline Emax dose-response with asymptote
  - progressive refractoriness in uncontrolled shock
  - causal feedback with dominant mechanism
  - debug-only driver deltas
- Added 4 canonical cases via JSON presets.
- Simple case selection (dropdown) without new screens.
- Initialization now preserves case-visible starting values (no hidden recalibration jump at `t=0`).
- Added automated intervention-response matrix tests (cardiogenic, septic, hypovolemic) with PASS/FAIL table output.

## Didactic Response Guardrails

The engine is calibrated so intervention effect is evaluated against a matched control trajectory (same case, seed, and time horizon), avoiding false interpretation from natural disease progression.

Current tested intervention classes:

- volume (`1000-2000 mL`)
- vasopressor (`norad`)
- inotrope (`dobutamine`)

Required didactic behavior enforced by tests:

- adequate intervention improves trajectory in the expected profile
- inadequate intervention does not produce disproportionate improvement
- profile-dependent response differences remain clear
- `dominantLimiter` and clamp activation logs are populated under stress

## Parametric Engine Architecture

The engine is now profile-parametric: central equations do not branch by case id/profile.

- `CaseData.profileParameters` (JSON) configures physiology and therapy response.
- `initializeCase(...)` normalizes parameters into `PatientState.profileParameters`.
- Core engine functions consume only `state.profileParameters` coefficients.

Main parameter groups:

- baseline scaling:
  - `contractilityBaseline`
  - `vascularToneBaseline`
  - `pulmonaryHydrostaticSensitivity`
  - `leakBaseline`
  - `betaSensitivity`
  - `ventricularCompliance`
  - `rightLeftCoupling`
- Starling/preload:
  - `starlingMid`, `starlingSlope`
  - `preloadResponsivenessBase/min/max`
  - `plateauScale`, `volumeRecruitmentGain`
- vasoactive/inotrope:
  - `norepiEmaxOffset`, `norepiEc50Multiplier`, `pressorGainScale`
  - `dobutamineContractilityGain`, `dobutamineAfterloadRelief`
  - `dobutamineFlowSupportBase`, `dobutamineFlowSupportLowOutputGain`
  - `dobutamineSvrOffset`
- congestion/hydrostatic:
  - `lvedp*`, `rightPressure*`, `gedi*`
  - `evlwLeakWeight`, `evlwHydroWeight`, `evlwHydroLvedpDivisor`, `evlwHydroCvpDivisor`
- volume-response:
  - `volumeResponse*` scales, gains, limits and tau
- distributive decoupling:
  - `mapDecouplingBias`

## Motor Patch (Phase 2.1)

### Noradrenaline Emax Model

Norad effect-site target is now modeled as:

`effect = Emax * dose^h / (EC50^h + dose^h)`

with:

- dose range: `0.0 - 3.0 mcg/kg/min`
- `Emax` modulated by hidden catecholamine sensitivity and vasoplegia severity
- `EC50` increased by vasoplegia and reduced sensitivity
- diminishing returns at higher doses (asymptotic behavior)

High doses produce warning events and higher adverse-event probability.

### Physiological Calibration (Motor Only)

This patch calibrated coefficients in `/engine/model.ts` and `/engine/effects.ts` without UI/layout changes.

- MAP coupling:
  - `MAP_target ≈ (CO * SVR) / 80 + RAP_offset`
  - partial distributive decoupling by microshunt/mitochondrial dysfunction (sepsis-like states)
  - anti-collapse guard to avoid abrupt MAP drops when CO/SVR are not dropping proportionally
- Preload / Frank-Starling:
  - steeper low-preload zone for hypovolemia
  - flatter response in cardiogenic-like physiology
  - explicit plateau behavior at high preload
- RV-LV coupling / PVR:
  - `PVR` increases with PEEP, hypoxemia, acidosis and ARDS burden
  - high `PVR` reduces LV preload transfer (VD->VE coupling penalty)
  - TEP presets keep persistently high pulmonary afterload
- DO2-VO2:
  - above critical DO2: VO2 plateaus near demand
  - below critical DO2: VO2 becomes supply-dependent
  - lactate rises with slower temporal inertia (delay), and clears more slowly
- EVLW / mechanics:
  - EVLW grows progressively from volume stress + hydrostatic/leak components
  - higher EVLW lowers dynamic compliance
  - lower compliance amplifies hemodynamic impact of PEEP
- Fluids/transfusion curves:
  - bolus/transfusion timing adjusted for smoother onset/peak/decay behavior
  - crystalloid bolus now induces dynamic hemodilution (Hb concentration effect) with damping
  - crystalloid retention is partial (intravascular fraction), decreasing with capillary leak/inflammation
  - intravascular retention now also decays with distension/overload to keep high-volume response asymptotic
  - transfusion now honors `targetHb` as a clinical ceiling-like target (response saturates near target)
  - Hb is initialized from hidden physiology when case `initialVisible.hb` is omitted
  - Hb now follows a red-cell mass model (`rbcMass / effective plasma volume`) instead of direct linear concentration drift
  - profile-specific volume response uses asymptotic drives (`sigmoid` + `tanh`) to avoid linear runaway gain
  - volume challenge uses bedside-like markers (`SVV`, `GEDI`, `CVP`, `EVLW`, `LAP/RAP`, `PVR`) to modulate response amplitude
  - profile parameters now scale preload proxy terms (`bloodVolume`, `Pms`, `venous return`) to separate hypovolemic vs congestive behavior
- Acid-base/gasometry coupling:
  - lactate rise/fall taus are adaptive (faster worsening under supply stress, slower clearance)
  - HCO3 follows metabolic acid load (lactate + mitochondrial dysfunction + supply dependency)
  - PaCO2 gets an additional perfusion/ventilation compensation target
  - pH/BE are recalculated each tick from Henderson-Hasselbalch consistency

### Hemodynamic Interaction Patch (PEEP + Norad + Volume)

To avoid runaway hemodynamics in combined high-PEEP/high-pressor states, engine interaction was updated to damped target dynamics (no per-tick multiplicative collapse):

- target update rule:
  - `X += (X_target - X) * (dt / tau)`
- tau bands used:
  - ventilatory effects: ~`8s`
  - vasopressor effects: ~`24-34s`
  - volume/preload effects: ~`16-55s` (profile-dependent)

Implemented adjustments:

- Pipeline guardrail:
  - physiology calibration is applied once per tick (`lastCalibrationTick`) to avoid double-apply artifacts
- PEEP hemodynamic contribution:
  - removed multiplicative per-tick penalties over VR/CO
  - replaced with target-based RAP/VR/CO updates
  - RAP target contribution from PEEP capped at `+6 mmHg` (compliance-adjusted cap)
- Afterload stacking:
  - removed strong duplicate afterload penalties
  - kept one dominant afterload pathway with weak secondary correction only
- GEDI/preload:
  - no simultaneous subtraction of RAP and PEEP in the same preload term
  - preload/GEDI now driven primarily by intrathoracic volume proxies plus damped coupling
- SVV behavior:
  - added congestion damping so high CVP/GEDI states do not keep SVV falsely elevated
- PVPI didactic floor:
  - maintained EVLW/PVPI coherence while avoiding non-didactic PVPI collapse in high leak
  - floor model: `PVPI_floor = 1.05 + 0.85 * capillaryLeak` (clamped)
- Combo stress (high PEEP + high pressor):
  - continuous `comboStressFactor in [0,1]` (no hard CO range clamp)
  - uses effect-site pressor drive (not commanded dose) for realistic onset delay
  - CO update uses damped relaxation with `tau ~24s`
- EVLW high-leak guardrail:
  - short positive-volume memory (`~300s`) adds hysteresis in high leak states
  - prevents non-physiologic EVLW drop immediately after large positive volume
  - implemented as target modulation, not direct hard clamping

### EAP Cardiogenic Profile C Refinement

For case id `eap_cardiogenico` only:

- retrograde pulmonary pressure:
  - `LVEDP` surrogate is updated from low LV contractility, elevated afterload and excess volume
  - pulmonary hydrostatic component is derived mainly from this LVEDP surrogate
- EVLW composition:
  - lower leak weight and higher hydrostatic weight (cardiogenic edema pattern)
- right-sided congestion coupling:
  - elevated pulmonary/LV filling pressure propagates to `RAP/CVP` with damping
- dobutamine under afterload:
  - boosts effective inotropy and partially offsets afterload penalty in profile C
- norepinephrine response:
  - preserved proportional SVR rise in severe cardiogenic states (non-neutral pressor effect)

### Competition Of Terms

Perfusion now reflects competing terms:

- pressor-driven SVR rise
- possible CO reduction (afterload and/or lower venous return)
- microcirculatory impairment (extraction/shunt)

Feedback highlights which term dominated that tick.

### Progressive Refractoriness

When instability persists (hypotension/lactate burden), effective catecholamine sensitivity drifts downward over time.

Acidemia/hypoxemia additionally reduce effective contractility trend.

### Causal Feedback + Debug Drivers

Simulation now emits:

- `dominantMechanism` string
- dev-only driver block:
  - `dSVR`
  - `dPVR`
  - `dVR` (venous return)
  - `dContractility`
  - `dShunt`

### Contextual Clinical Feedback

Feedback logic is centralized in:

- `generateClinicalFeedback(previousState, currentState, caseProfile, history)`

Feedback now uses a temporal window (`30-60s`, when available) built from trend history + current tick.

Each update always renders one current-state summary (no accumulation) with 4 fixed blocks:

- `ESTADO HEMODINAMICO`
- `MECANISMO DOMINANTE`
- `PERFUSAO TECIDUAL`
- `IMPLICACAO CLINICA`

No generic fallback text is used.
Timeline remains separate and concise (interventions/events only).

Hemodynamic state classification is dynamic and computed from:

- `DC`, `SVR`, `PVR`, `GEDI`, `EVLW`, `RAP`, `extractionEfficiency`

Classes:

- choque distributivo predominante
- choque cardiogenico predominante
- choque obstrutivo predominante
- choque hipovolemico predominante
- choque misto (when competing scores are close)

Dominant mechanism ranking is computed from relative contributions of:

- `dSVR`, `dCO`, `dVR`, `dPVR`, `dExtraction`, `dShunt`, `dContractility`

Trend analysis includes:

- PAM trend
- DC trend
- lactate trend
- DO2 trend
- CO vs SVR coupling/decoupling

Clinical risk escalation includes:

- severe shock (`PAM < 50` and `DC < 2.5`)
- supply dependency onset (`DO2` near critical with falling `VO2`)
- sustained lactate rise (persistent hypoperfusion pattern)

Rules remain profile-aware (`caseProfile`) and intervention-aware:

- sepsis advanced: DO2-VO2 dissociation patterns and vasopressor limits
- hypovolemic/hemorrhagic: volume responsiveness vs pressor-only response
- cardiogenic (congestive / low-output): EVLW congestion risk and inotrope response
- TEP obstructive: PVR-dominant RV-LV coupling impairment

Ventilation-hemodynamics coupling is explicitly interpreted (e.g. PEEP can improve oxygenation by shunt reduction while reducing venous return/CO).

## Therapy Ranges (Current)

- Norad: `0 - 3 mcg/kg/min`
- Dobutamine: `0 - 20 mcg/kg/min`
- Vasopressin: `0 - 0.06 U/min`
- PEEP: `5 - 20 cmH2O`
- FiO2: `0.21 - 1.0`
- Bolus: `250 / 500 / 1000 mL`

## Monitor Variables (EV1000-like)

Display derivation is centralized in `/sim/displayVars.ts`:

- `deriveDisplayVars(...)`
- `deriveDisplayVarsFromPatient(...)`
- `deriveDisplayVarsFromTrendPoint(...)`

Core formulas:

- `CI = CO / BSA`
- `SV = CO * 1000 / HR`
- `SVI = SV / BSA`
- `SVRI = SVR * BSA`
- `CPO = (MAP * CO) / 451`
- `CPI = CPO / BSA`
- `DO2I = DO2 / BSA`
- `VO2I = VO2 / BSA`
- `ITBVI = ITBV / BSA`
- `PVRI = PVR * BSA`

Estimated (didactic) variables when direct values are unavailable in trend snapshots:

- `SVV` (estimated from preload + ventilatory effect)
- `GEDI` (estimated from flow/preload proxies)
- `ITBV` (estimated from `GEDI * 1.24`)

These are explicitly educational estimates, not proprietary PiCCO/VolumeView algorithms.

## New Cases (Phase 3.0)

Added in `/cases`:

- `eap_cardiogenico`
- `choque_hipovolemico_hemorragico`
- `tep_macico_obstrutivo`
- `eap_perfil_l`

Each case includes:

- `initialVisible`
- `initialHidden`
- `caseProfile`
- `hiddenRanges` (seed-based sampling)
- `progression`
- `expectedPatterns` (educational initial guidance)

## Case Selection

- Simple dropdown in header (no redesign).
- Switching case resets simulation with current seed.

## Tests

All tests are behavior/range-oriented.

- existing invariants and deterministic run
- new phase 2.1 tests:
  - norad dose-response saturation + adverse risk trend
  - PEEP oxygenation/hemodynamic tradeoff across seeds
- contextual feedback tests:
  - 4-block output contract is always present
  - severe shock escalation (`PAM < 50` and `DC < 2.5`)
  - supply dependency detection by trend
  - sustained lactate rise interpretation
  - SVR up + CO down -> afterload excess mechanism
  - obstructive profile classification from `PVR + RAP + preload drop`
- calibration tests:
  - hypovolemic profile shows stronger volume responsiveness than cardiogenic low-output profile
  - TEP + higher PEEP increases PVR and depresses CO
  - low-DO2 state shows VO2 supply dependency with delayed lactate rise
- derivation tests:
  - `CO + HR -> SV`
  - `CO / BSA -> CI`
  - `SVR * BSA -> SVRI`
  - `CPO`, `DO2I`, `VO2I` formulas

## Run

```bash
npm install
npm run test
npm run build
npm run dev
```

Open `http://localhost:3000`.
