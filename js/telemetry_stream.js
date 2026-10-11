/**
 * Real-Time Wearable Health Anomaly Radar
 * Telemetry Stream Generator (telemetry_stream.js)
 * 
 * Supports:
 * 1. Single Emergency Spike (HR ~160 bpm, low activity, normal SpO2)
 * 2. Multi-Signal Emergency (elevated HR, decreased SpO2, low activity, temperature shift)
 * 3. Normal Exertion & Daily Baseline
 * 4. Genuine injection timestamp recording for accurate latency benchmarking
 */

class TelemetryStreamGenerator {
  constructor() {
    this.currentHR = 72.0;
    this.currentSpO2 = 98.4;
    this.currentActivity = 0.5;
    this.currentTemp = 36.6;

    this.targetHR = 72.0;
    this.targetSpO2 = 98.4;
    this.targetActivity = 0.5;
    this.targetTemp = 36.6;

    this.activeScenario = 'NORMAL';
    this.scenarioRemainingSec = 0;
    this.lastInjectionTimestamp = null;

    this.tickCount = 0;
    this.ecgPhase = 0.0;
    this.subscribers = [];
  }

  onSample(callback) {
    this.subscribers.push(callback);
  }

  tick() {
    this.tickCount++;

    const smoothFactor = 0.35;
    this.currentHR += (this.targetHR - this.currentHR) * smoothFactor;
    this.currentSpO2 += (this.targetSpO2 - this.currentSpO2) * smoothFactor;
    this.currentActivity += (this.targetActivity - this.currentActivity) * smoothFactor;
    this.currentTemp += (this.targetTemp - this.currentTemp) * smoothFactor;

    const hrNoise = (Math.random() - 0.5) * 1.6 + Math.sin(this.tickCount * 0.4) * 1.2;
    const spo2Noise = (Math.random() - 0.5) * 0.3;
    const actNoise = Math.max(0, (Math.random() - 0.5) * 0.15);
    const tempNoise = (Math.random() - 0.5) * 0.04;

    const sample = {
      timestamp: Date.now(),
      tick: this.tickCount,
      hr: Math.round((Math.max(30, Math.min(220, this.currentHR + hrNoise))) * 10) / 10,
      spo2: Math.round((Math.max(65, Math.min(100, this.currentSpO2 + spo2Noise))) * 10) / 10,
      activity: Math.round((Math.max(0, Math.min(10, this.currentActivity + actNoise))) * 10) / 10,
      temp: Math.round((Math.max(33.0, Math.min(42.5, this.currentTemp + tempNoise))) * 100) / 100,
      scenario: this.activeScenario,
      injectionTimestamp: this.lastInjectionTimestamp
    };

    if (this.scenarioRemainingSec > 0) {
      this.scenarioRemainingSec--;
      if (this.scenarioRemainingSec === 0) {
        this.resetToNormal();
      }
    }

    this.subscribers.forEach(cb => cb(sample));
    return sample;
  }

  getECGVoltage(deltaSeconds, hr) {
    const frequencyHz = hr / 60.0;
    this.ecgPhase = (this.ecgPhase + frequencyHz * deltaSeconds) % 1.0;
    const p = this.ecgPhase;

    if (p >= 0.10 && p <= 0.20) {
      return 0.15 * Math.sin(((p - 0.10) / 0.10) * Math.PI);
    }
    if (p >= 0.24 && p < 0.28) {
      return -0.18 * Math.sin(((p - 0.24) / 0.04) * Math.PI);
    }
    if (p >= 0.28 && p <= 0.34) {
      const r = (p - 0.28) / 0.06;
      if (r < 0.5) return 1.2 * (r / 0.5);
      return 1.2 * (1 - (r - 0.5) / 0.5);
    }
    if (p > 0.34 && p <= 0.40) {
      return -0.28 * Math.sin(((p - 0.34) / 0.06) * Math.PI);
    }
    if (p >= 0.48 && p <= 0.68) {
      return 0.25 * Math.sin(((p - 0.48) / 0.20) * Math.PI);
    }
    return (Math.random() - 0.5) * 0.03;
  }

  // ================= SCENARIO INJECTIONS ================= //

  /**
   * 🚨 Emergency Spike (Single Channel HR elevation at rest, SpO2 normal)
   */
  injectCardiacSpike(hr = 164, durationSec = 30) {
    this.lastInjectionTimestamp = performance.now();
    this.activeScenario = 'EMERGENCY_SPIKE';
    this.targetHR = hr;
    this.targetActivity = 0.2; // Sedentary / low
    this.targetSpO2 = 97.8;    // Normal SpO2!
    this.targetTemp = 36.6;    // Normal Temp!
    this.scenarioRemainingSec = durationSec;
  }

  /**
   * 🚨 NEW: Multi-Signal Emergency
   * Significantly elevated HR + decreased SpO2 + low activity + small temp deviation
   */
  injectMultiSignalEmergency(hr = 162, spo2 = 86.5, temp = 38.2, durationSec = 30) {
    this.lastInjectionTimestamp = performance.now();
    this.activeScenario = 'MULTI_SIGNAL_EMERGENCY';
    this.targetHR = hr;
    this.targetSpO2 = spo2;      // Decreased SpO2!
    this.targetActivity = 0.3;   // Low activity
    this.targetTemp = temp;      // Small temperature deviation (elevated)
    this.scenarioRemainingSec = durationSec;
  }

  /**
   * 🏃 Vigorous Workout (High HR + High Activity -> Verifies NO False Alarm)
   */
  simulateWorkout(intensity = 8.5, durationSec = 30) {
    this.lastInjectionTimestamp = performance.now();
    this.activeScenario = 'VIGOROUS_WORKOUT';
    this.targetActivity = intensity;
    this.targetHR = 158.0;
    this.targetSpO2 = 97.2;
    this.targetTemp = 37.3;
    this.scenarioRemainingSec = durationSec;
  }

  /**
   * 🚶 Normal Walking
   */
  simulateNormalWalk(durationSec = 20) {
    this.lastInjectionTimestamp = performance.now();
    this.activeScenario = 'LIGHT_WALKING';
    this.targetActivity = 3.2;
    this.targetHR = 96.0;
    this.targetSpO2 = 98.0;
    this.targetTemp = 36.7;
    this.scenarioRemainingSec = durationSec;
  }

  /**
   * 🎛️ Custom Parameters
   */
  injectCustom(hr, spo2, activity, temp, durationSec = 30) {
    this.lastInjectionTimestamp = performance.now();
    this.activeScenario = 'CUSTOM_INJECTION';
    this.targetHR = Number(hr);
    this.targetSpO2 = Number(spo2);
    this.targetActivity = Number(activity);
    this.targetTemp = Number(temp);
    this.scenarioRemainingSec = durationSec;
  }

  /**
   * 🔄 Reset Simulation to Normal Baseline
   */
  resetToNormal() {
    this.activeScenario = 'NORMAL';
    this.targetHR = 72.0;
    this.targetSpO2 = 98.4;
    this.targetActivity = 0.5;
    this.targetTemp = 36.6;
    this.currentHR = 72.0;
    this.currentSpO2 = 98.4;
    this.currentActivity = 0.5;
    this.currentTemp = 36.6;
    this.scenarioRemainingSec = 0;
    this.lastInjectionTimestamp = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TelemetryStreamGenerator;
}
