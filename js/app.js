/**
 * Real-Time Wearable Health Anomaly Radar
 * Main Application Controller (app.js)
 * 
 * Safety & Regulatory Principles:
 * - Alert Title: "CRITICAL MULTI-SIGNAL ANOMALY"
 * - Language: "Significant deviation from the individual's personalized baseline detected."
 * - Non-diagnostic: Evaluates multi-signal biometric departures.
 * - Measured latency: Displays genuine measured latency from injection to detection.
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = new HealthAnomalyRadarEngine();
  const stream = new TelemetryStreamGenerator();
  const notifier = new DoctorNotifier();

  // Audio Alarm Synthesizer
  let audioCtx = null;
  let isSoundEnabled = false;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playAlertBeep(frequency = 880, duration = 0.18) {
    if (!isSoundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Canvas Initializer
  const charts = new HealthRadarCharts({
    ecg: document.getElementById('canvas-ecg'),
    multiSignal: document.getElementById('canvas-multisignal'),
    phaseSpace: document.getElementById('canvas-phasespace'),
    gauge: document.getElementById('canvas-gauge')
  });

  function resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    ['canvas-ecg', 'canvas-multisignal', 'canvas-phasespace', 'canvas-gauge'].forEach(id => {
      const cv = document.getElementById(id);
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cv.width = rect.width * dpr;
        cv.height = rect.height * dpr;
        const ctx = cv.getContext('2d');
        ctx.scale(dpr, dpr);
      }
    });
  }
  window.addEventListener('resize', resizeCanvases);
  setTimeout(resizeCanvases, 100);

  // UI Element References
  const valHR = document.getElementById('val-hr');
  const valSpO2 = document.getElementById('val-spo2');
  const valActivity = document.getElementById('val-activity');
  const valTemp = document.getElementById('val-temp');

  const baseHR = document.getElementById('base-hr');
  const baseSpO2 = document.getElementById('base-spo2');
  const baseTemp = document.getElementById('base-temp');

  const alertBanner = document.getElementById('alert-banner');
  const alertTitle = document.getElementById('alert-title');
  const alertDetail = document.getElementById('alert-detail');
  const alertRisk = document.getElementById('alert-risk');
  const alertBadge = document.getElementById('alert-badge');
  const scenarioBadge = document.getElementById('scenario-badge');
  const lblLatency = document.getElementById('lbl-latency');

  const doctorDispatchCard = document.getElementById('doctor-dispatch-card');
  const dispatchPatient = document.getElementById('dispatch-patient');
  const dispatchReason = document.getElementById('dispatch-reason');
  const dispatchTime = document.getElementById('dispatch-time');
  const dispatchStats = document.getElementById('dispatch-stats');
  const dispatchActions = document.getElementById('dispatch-actions');
  const dispatchModal = document.getElementById('dispatch-modal');
  const modalContent = document.getElementById('modal-content');

  const auditLogTable = document.getElementById('audit-log-body');
  const soundToggleBtn = document.getElementById('btn-sound-toggle');

  let latestDispatch = null;
  let lastEvaluatedSeverity = 'NORMAL';

  // Latency Measurement State
  let injectionStartTime = null;
  let hasMeasuredLatencyForCurrentEvent = false;

  function markInjectionStart() {
    injectionStartTime = performance.now();
    hasMeasuredLatencyForCurrentEvent = false;
    if (lblLatency) {
      lblLatency.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1"></span>Measuring Latency...';
    }
  }

  // Telemetry Stream Handler
  stream.onSample((sample) => {
    const evaluation = engine.processReading(sample);
    charts.pushTelemetrySample(sample, evaluation);

    // Update Numerical Metrics
    valHR.textContent = Math.round(sample.hr);
    valSpO2.textContent = sample.spo2.toFixed(1);
    valActivity.textContent = sample.activity.toFixed(1);
    valTemp.textContent = sample.temp.toFixed(1);

    // Update Baseline Displays
    if (evaluation.baseline) {
      baseHR.textContent = `${evaluation.baseline.hrMean} ± ${evaluation.baseline.hrStd} bpm`;
      baseSpO2.textContent = `${evaluation.baseline.spo2Mean}%`;
      baseTemp.textContent = `${evaluation.baseline.tempMean}°C`;
    }

    // Measure Genuine Latency from Injection to Detection
    if (injectionStartTime !== null && !hasMeasuredLatencyForCurrentEvent) {
      if (evaluation.severity === 'CRITICAL' || evaluation.severity === 'WARNING') {
        const elapsedMs = Math.round(performance.now() - injectionStartTime);
        hasMeasuredLatencyForCurrentEvent = true;
        if (lblLatency) {
          if (elapsedMs < 1000) {
            lblLatency.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1"></span>Detection Latency: <strong class="text-white">${elapsedMs} ms</strong>`;
          } else {
            lblLatency.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1"></span>Detection Latency: <strong class="text-white">${(elapsedMs / 1000).toFixed(2)} s</strong>`;
          }
        }
      }
    }

    // Scenario Labeling
    const scenarioLabels = {
      'NORMAL': 'Active Stream: Normal Baseline',
      'EMERGENCY_SPIKE': '🚨 INJECTED: Emergency Spike (HR ~160 bpm @ Rest, Normal SpO2)',
      'MULTI_SIGNAL_EMERGENCY': '🚨 INJECTED: Multi-Signal Emergency (Elevated HR + Reduced SpO2 + Rest)',
      'VIGOROUS_WORKOUT': '🏃 SIMULATING: Vigorous Workout (High HR + High Activity)',
      'LIGHT_WALKING': '🚶 SIMULATING: Normal Light Walking',
      'CUSTOM_INJECTION': '🎛️ INJECTED: Custom Manual Parameters'
    };
    scenarioBadge.textContent = scenarioLabels[sample.scenario] || sample.scenario;

    const severity = evaluation.severity;
    lastEvaluatedSeverity = severity;

    if (severity === 'CRITICAL') {
      alertBanner.classList.remove('hidden', 'border-amber-500', 'bg-amber-950/40');
      alertBanner.classList.add('border-rose-500', 'bg-rose-950/60', 'animate-pulse');
      alertBadge.className = 'px-3 py-1 text-xs font-bold uppercase rounded-full bg-rose-600 text-white animate-bounce';
      alertBadge.textContent = 'CRITICAL MULTI-SIGNAL ANOMALY';
      alertTitle.textContent = 'CRITICAL MULTI-SIGNAL ANOMALY';
      alertDetail.textContent = evaluation.primaryReason;
      alertRisk.textContent = `Composite Anomaly Score: ${evaluation.anomalyScore}/10.0`;

      latestDispatch = notifier.generateDispatch(evaluation);
      renderDoctorDispatchCard(latestDispatch);
      addAuditLogRow(evaluation);
      playAlertBeep(920, 0.25);
    } else if (severity === 'WARNING') {
      alertBanner.classList.remove('hidden', 'border-rose-500', 'bg-rose-950/60', 'animate-pulse');
      alertBanner.classList.add('border-amber-500', 'bg-amber-950/40');
      alertBadge.className = 'px-3 py-1 text-xs font-bold uppercase rounded-full bg-amber-500 text-black';
      alertBadge.textContent = 'ELEVATED WARNING';
      alertTitle.textContent = 'PHYSIOLOGICAL ANOMALY WARNING';
      alertDetail.textContent = evaluation.primaryReason;
      alertRisk.textContent = `Composite Anomaly Score: ${evaluation.anomalyScore}/10.0`;

      latestDispatch = notifier.generateDispatch(evaluation);
      renderDoctorDispatchCard(latestDispatch);
      playAlertBeep(650, 0.15);
    } else {
      if (evaluation.isExertionExplained) {
        alertBanner.classList.remove('hidden', 'border-rose-500', 'bg-rose-950/60', 'animate-pulse', 'border-amber-500', 'bg-amber-950/40');
        alertBanner.classList.add('border-emerald-500', 'bg-emerald-950/30');
        alertBadge.className = 'px-3 py-1 text-xs font-bold uppercase rounded-full bg-emerald-500 text-black';
        alertBadge.textContent = 'WORKOUT VERIFIED • NO FALSE ALARM';
        alertTitle.textContent = 'Physiological Exertion Confirmed';
        alertDetail.textContent = evaluation.primaryReason;
        alertRisk.textContent = `Risk Score: ${evaluation.anomalyScore}/10.0 (Suppressed by Activity Gating)`;
      } else {
        alertBanner.classList.add('hidden');
      }
    }

    charts.renderGauge(evaluation.anomalyScore, severity);
    charts.renderPhaseSpaceCorridor(sample, evaluation);
  });

  function renderDoctorDispatchCard(dispatch) {
    if (!dispatch) return;
    doctorDispatchCard.classList.remove('hidden');
    dispatchPatient.textContent = `${dispatch.patient.name} (${dispatch.patient.patientId}, Age ${dispatch.patient.age})`;
    dispatchReason.textContent = dispatch.summary.primaryReason;
    dispatchTime.textContent = `Incident ID: ${dispatch.eventId} • Time: ${dispatch.timestamp}`;

    dispatchStats.innerHTML = dispatch.metrics.map(m => `
      <div class="flex items-center justify-between text-xs py-1 border-b border-slate-700/50">
        <span class="text-slate-400">${m.signal}</span>
        <div class="flex items-center space-x-3">
          <span class="font-bold text-white">${m.current}</span>
          <span class="text-slate-400">Base: ${m.baseline}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.status.includes('SIGNIFICANT') ? 'bg-rose-600/30 text-rose-300' : 'bg-slate-700 text-slate-300'}">${m.status}</span>
        </div>
      </div>
    `).join('');

    dispatchActions.innerHTML = dispatch.actions.map(act => `
      <li class="text-xs text-slate-300 flex items-start space-x-2">
        <span class="text-rose-400 font-bold">•</span>
        <span>${act}</span>
      </li>
    `).join('');
  }

  function addAuditLogRow(evaluation) {
    if (!auditLogTable) return;
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800 text-xs hover:bg-slate-800/40 transition-colors';
    const timeStr = new Date(evaluation.timestamp).toLocaleTimeString();
    row.innerHTML = `
      <td class="py-2 px-3 font-mono text-slate-400">${timeStr}</td>
      <td class="py-2 px-3">
        <span class="px-2 py-0.5 rounded font-bold ${evaluation.severity === 'CRITICAL' ? 'bg-rose-900/60 text-rose-300' : 'bg-amber-900/60 text-amber-300'}">${evaluation.severity}</span>
      </td>
      <td class="py-2 px-3 font-semibold text-slate-200">${evaluation.alertTitle}</td>
      <td class="py-2 px-3 font-mono text-slate-300">HR: ${evaluation.reading.hr} | SpO2: ${evaluation.reading.spo2}% | Act: ${evaluation.reading.activity}</td>
      <td class="py-2 px-3 text-slate-400 truncate max-w-xs">${evaluation.primaryReason}</td>
    `;
    auditLogTable.insertBefore(row, auditLogTable.firstChild);
    while (auditLogTable.children.length > 20) {
      auditLogTable.removeChild(auditLogTable.lastChild);
    }
  }

  // Animation Loop (60fps)
  let lastFrameTime = performance.now();
  function animationLoop(timestamp) {
    const delta = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    const ecgVoltage = stream.getECGVoltage(delta, stream.currentHR);
    charts.pushECGVoltage(ecgVoltage);
    charts.renderECG(stream.currentHR, lastEvaluatedSeverity);
    charts.renderMultiSignalCharts();

    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);

  // 1 Hz Simulation Tick
  setInterval(() => {
    stream.tick();
  }, 1000);

  // ================= SIMULATION CONTROLS ================= //

  // Mode 1: Emergency Spike (Single HR Spike at Rest, SpO2 Normal)
  document.getElementById('btn-inject-cardiac').addEventListener('click', () => {
    initAudio();
    markInjectionStart();
    stream.injectCardiacSpike(164);
  });

  // Mode 2: Multi-Signal Emergency (Elevated HR + Reduced SpO2 + Rest + Mild Temp Shift)
  const btnMultiSignal = document.getElementById('btn-inject-multisignal');
  if (btnMultiSignal) {
    btnMultiSignal.addEventListener('click', () => {
      initAudio();
      markInjectionStart();
      stream.injectMultiSignalEmergency(162, 86.5, 38.2);
    });
  }

  // Vigorous Workout (Judge Benchmark - No False Alarm)
  document.getElementById('btn-sim-workout').addEventListener('click', () => {
    initAudio();
    markInjectionStart();
    stream.simulateWorkout(8.5);
  });

  // Normal Walking
  document.getElementById('btn-sim-walk').addEventListener('click', () => {
    initAudio();
    markInjectionStart();
    stream.simulateNormalWalk();
  });

  // Reset to Baseline
  document.getElementById('btn-reset-normal').addEventListener('click', () => {
    stream.resetToNormal();
    engine.reset();
    injectionStartTime = null;
    hasMeasuredLatencyForCurrentEvent = false;
    alertBanner.classList.add('hidden');
    doctorDispatchCard.classList.add('hidden');
    if (lblLatency) {
      lblLatency.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 mr-1"></span>Detection Latency: <strong class="text-white">Active (sub-second)</strong>';
    }
  });

  // Custom Sliders
  const sliderHR = document.getElementById('slider-hr');
  const sliderSpO2 = document.getElementById('slider-spo2');
  const sliderAct = document.getElementById('slider-activity');
  const sliderTemp = document.getElementById('slider-temp');

  const lblSliderHR = document.getElementById('lbl-slider-hr');
  const lblSliderSpO2 = document.getElementById('lbl-slider-spo2');
  const lblSliderAct = document.getElementById('lbl-slider-activity');
  const lblSliderTemp = document.getElementById('lbl-slider-temp');

  if (sliderHR) {
    sliderHR.addEventListener('input', (e) => { lblSliderHR.textContent = `${e.target.value} bpm`; });
    sliderSpO2.addEventListener('input', (e) => { lblSliderSpO2.textContent = `${e.target.value}%`; });
    sliderAct.addEventListener('input', (e) => { lblSliderAct.textContent = `${parseFloat(e.target.value).toFixed(1)} METs`; });
    sliderTemp.addEventListener('input', (e) => { lblSliderTemp.textContent = `${parseFloat(e.target.value).toFixed(1)}°C`; });

    document.getElementById('btn-inject-custom').addEventListener('click', () => {
      initAudio();
      markInjectionStart();
      stream.injectCustom(sliderHR.value, sliderSpO2.value, sliderAct.value, sliderTemp.value);
    });
  }

  // Profile Selector
  const selectProfile = document.getElementById('select-profile');
  if (selectProfile) {
    selectProfile.addEventListener('change', (e) => {
      engine.setProfile(e.target.value);
      if (e.target.value === 'athlete') {
        notifier.setPatientInfo({
          name: "Alex Rivera (Marathon Runner)",
          patientId: "MRN-109284",
          age: 29
        });
      } else if (e.target.value === 'elderly_copd') {
        notifier.setPatientInfo({
          name: "Harold Miller (COPD Stage II)",
          patientId: "MRN-449102",
          age: 72
        });
      } else {
        notifier.setPatientInfo({
          name: "Marcus Vance",
          patientId: "MRN-884920",
          age: 54
        });
      }
      stream.resetToNormal();
      alertBanner.classList.add('hidden');
      doctorDispatchCard.classList.add('hidden');
    });
  }

  // Sound Toggle
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      initAudio();
      isSoundEnabled = !isSoundEnabled;
      soundToggleBtn.textContent = isSoundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      soundToggleBtn.classList.toggle('bg-emerald-600', isSoundEnabled);
      soundToggleBtn.classList.toggle('bg-slate-700', !isSoundEnabled);
      if (isSoundEnabled) playAlertBeep(440, 0.1);
    });
  }

  // Modal Handlers
  document.getElementById('btn-view-soap').addEventListener('click', () => {
    if (!latestDispatch) return;
    dispatchModal.classList.remove('hidden');
    modalContent.textContent = latestDispatch.soap;
  });

  document.getElementById('btn-view-fhir').addEventListener('click', () => {
    if (!latestDispatch) return;
    dispatchModal.classList.remove('hidden');
    modalContent.textContent = JSON.stringify(latestDispatch.fhir, null, 2);
  });

  document.getElementById('btn-view-sms').addEventListener('click', () => {
    if (!latestDispatch) return;
    dispatchModal.classList.remove('hidden');
    modalContent.textContent = latestDispatch.sms;
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    dispatchModal.classList.add('hidden');
  });

  document.getElementById('btn-copy-modal').addEventListener('click', () => {
    navigator.clipboard.writeText(modalContent.textContent).then(() => {
      const btn = document.getElementById('btn-copy-modal');
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = 'Copy Text'; }, 2000);
    });
  });

  document.getElementById('btn-ack-alert').addEventListener('click', () => {
    alertBanner.classList.add('hidden');
  });
});
