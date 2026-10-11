/**
 * Real-Time Wearable Health Anomaly Radar
 * Data Models & Payload Validation (models.js)
 */

const HealthModels = (() => {
  // Configurable clinical threshold defaults
  const DefaultConfig = {
    warningThreshold: 4.5,
    criticalThreshold: 7.2,
    persistenceWindow: 2,         // consecutive anomaly ticks required before raising alert
    hysteresisCooldownSec: 6,     // recovery stability window before clearing alert
    baselineLearningRate: 0.035,  // EWMA adaptation factor during normal states
    calibrationDurationSec: 15,   // Initial warmup calibration period
    freezeBaselineOnAnomaly: true,// Crucial safety feature: prevent anomaly contamination
    maxHistoryBuffer: 180         // 3 minutes of high-resolution telemetry points
  };

  // Preset clinical profiles
  const Profiles = {
    standard: {
      id: 'standard',
      name: 'Marcus Vance',
      age: 54,
      mrn: 'MRN-884920',
      condition: 'Standard Adult Baseline',
      physician: 'Dr. Evelyn Reed, MD (Cardiology)',
      facility: 'Pacific Health Cardiovascular Center',
      baseline: {
        hr: { mean: 72.0, std: 6.0, min: 58, max: 92 },
        spo2: { mean: 98.4, std: 0.8, min: 96, max: 100 },
        temp: { mean: 36.6, std: 0.25, min: 36.2, max: 37.1 },
        activity: { mean: 0.6, std: 0.8, min: 0.0, max: 3.5 }
      }
    },
    athlete: {
      id: 'athlete',
      name: 'Elena Rostova',
      age: 29,
      mrn: 'MRN-912044',
      condition: 'Endurance Athlete (Physiological Bradycardia)',
      physician: 'Dr. Gregory Thorne, MD (Sports Med)',
      facility: 'Olympic Performance Lab & Telemetry',
      baseline: {
        hr: { mean: 48.0, std: 5.2, min: 40, max: 68 },
        spo2: { mean: 99.0, std: 0.6, min: 97, max: 100 },
        temp: { mean: 36.5, std: 0.22, min: 36.1, max: 37.0 },
        activity: { mean: 1.8, std: 2.2, min: 0.0, max: 7.5 }
      }
    },
    elderly_copd: {
      id: 'elderly_copd',
      name: 'Harold Vance Miller',
      age: 73,
      mrn: 'MRN-741982',
      condition: 'COPD Stage II / Mild Baseline Hypoxemia',
      physician: 'Dr. Aris Thorne, MD (Pulmonology / Tele-Triage)',
      facility: 'St. Jude Telehealth Respiratory Wing',
      baseline: {
        hr: { mean: 79.0, std: 6.8, min: 65, max: 96 },
        spo2: { mean: 93.2, std: 1.2, min: 90, max: 96 }, // Target SpO2 88-92% per GOLD guidelines
        temp: { mean: 36.4, std: 0.28, min: 35.9, max: 36.9 },
        activity: { mean: 0.4, std: 0.5, min: 0.0, max: 1.8 }
      }
    }
  };

  /**
   * Validate incoming raw sensor payload
   */
  function validateSensorPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Empty or invalid sensor frame' };
    }

    const timestamp = Number(payload.timestamp) || Date.now();
    const hr = Number(payload.hr);
    const spo2 = Number(payload.spo2);
    const activity = Number(payload.activity);
    const temp = Number(payload.temp);

    // Range checks
    if (isNaN(hr) || hr < 25 || hr > 260) {
      return { valid: false, error: `HR value out of physiological range (25-260 bpm): ${payload.hr}` };
    }
    if (isNaN(spo2) || spo2 < 50 || spo2 > 100) {
      return { valid: false, error: `SpO2 value out of range (50-100%): ${payload.spo2}` };
    }
    if (isNaN(activity) || activity < 0 || activity > 20) {
      return { valid: false, error: `Activity value out of range (0-20 METs): ${payload.activity}` };
    }
    if (isNaN(temp) || temp < 30 || temp > 45) {
      return { valid: false, error: `Temperature value out of range (30-45°C): ${payload.temp}` };
    }

    return {
      valid: true,
      data: {
        timestamp,
        hr: Math.round(hr * 10) / 10,
        spo2: Math.round(spo2 * 10) / 10,
        activity: Math.round(activity * 10) / 10,
        temp: Math.round(temp * 100) / 100,
        signalQuality: payload.signalQuality !== undefined ? payload.signalQuality : 99.2,
        ingestTimestamp: payload.ingestTimestamp || Date.now()
      }
    };
  }

  return {
    DefaultConfig,
    Profiles,
    validateSensorPayload
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthModels;
}
