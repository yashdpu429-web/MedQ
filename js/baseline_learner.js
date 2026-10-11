/**
 * Real-Time Wearable Health Anomaly Radar
 * Personal Baseline Learning Engine (baseline_learner.js)
 * 
 * Implements unsupervised rolling online baseline adaptation with EWMA,
 * context-aware exertion stratification, and baseline protection against
 * active anomaly contamination.
 */

class PersonalBaselineLearner {
  constructor(initialProfile = 'standard', options = {}) {
    this.options = Object.assign({
      learningRateMean: 0.035,
      learningRateVar: 0.02,
      calibrationWindowTicks: 15,
      freezeOnAnomaly: true
    }, options);

    this.profileKey = initialProfile;
    this.totalSamplesProcessed = 0;
    this.calibrationTicks = 0;
    this.isCalibrated = false;
    this.isFrozen = false; // Emergency freeze flag to avoid anomaly contamination

    this.metrics = ['hr', 'spo2', 'temp', 'activity'];
    this.stats = {};

    this.loadProfile(initialProfile);
  }

  /**
   * Initialize baseline statistics from selected profile preset
   */
  loadProfile(profileKey) {
    const profile = (HealthModels.Profiles && HealthModels.Profiles[profileKey]) || HealthModels.Profiles.standard;
    this.profileKey = profileKey;
    this.profile = profile;

    this.stats = {
      hr: {
        mean: profile.baseline.hr.mean,
        variance: Math.pow(profile.baseline.hr.std, 2),
        std: profile.baseline.hr.std,
        restingMean: profile.baseline.hr.mean,
        activeExpectedFactor: 11.5 // Expected BPM rise per MET
      },
      spo2: {
        mean: profile.baseline.spo2.mean,
        variance: Math.pow(profile.baseline.spo2.std, 2),
        std: profile.baseline.spo2.std
      },
      temp: {
        mean: profile.baseline.temp.mean,
        variance: Math.pow(profile.baseline.temp.std, 2),
        std: profile.baseline.temp.std
      },
      activity: {
        mean: profile.baseline.activity.mean,
        variance: Math.pow(profile.baseline.activity.std, 2),
        std: profile.baseline.activity.std
      }
    };

    this.totalSamplesProcessed = 0;
    this.calibrationTicks = 0;
    this.isCalibrated = false;
    this.isFrozen = false;
  }

  /**
   * Process a clean sample and update EWMA baseline statistics.
   * Crucial safety guarantee: do NOT update when frozen or when sample is flagged as anomalous.
   */
  update(sample, isAnomalous = false) {
    this.totalSamplesProcessed++;

    // Check calibration state
    if (!this.isCalibrated) {
      this.calibrationTicks++;
      if (this.calibrationTicks >= this.options.calibrationWindowTicks) {
        this.isCalibrated = true;
      }
    }

    // Baseline Contamination Guard:
    // If anomaly is present and freezeOnAnomaly is enabled, bypass updating!
    if (this.isFrozen || (isAnomalous && this.options.freezeOnAnomaly)) {
      return {
        updated: false,
        reason: 'Baseline update frozen to prevent pathological drift'
      };
    }

    // Adaptive learning rate: faster during initial calibration, stable during continuous tracking
    const alphaMean = !this.isCalibrated ? 0.12 : this.options.learningRateMean;
    const alphaVar = !this.isCalibrated ? 0.08 : this.options.learningRateVar;

    // 1. Heart Rate adaptation (gated by activity to avoid tracking exercise as resting baseline)
    if (sample.activity <= 1.5) {
      const hrDiff = sample.hr - this.stats.hr.mean;
      this.stats.hr.mean += alphaMean * hrDiff;
      this.stats.hr.variance = (1 - alphaVar) * this.stats.hr.variance + alphaVar * Math.pow(hrDiff, 2);
      this.stats.hr.std = Math.max(3.5, Math.sqrt(this.stats.hr.variance));
      this.stats.hr.restingMean = this.stats.hr.mean;
    }

    // 2. SpO2 adaptation (only update when stable and non-hypoxic)
    if (sample.spo2 >= 92) {
      const spo2Diff = sample.spo2 - this.stats.spo2.mean;
      this.stats.spo2.mean += alphaMean * spo2Diff;
      this.stats.spo2.variance = (1 - alphaVar) * this.stats.spo2.variance + alphaVar * Math.pow(spo2Diff, 2);
      this.stats.spo2.std = Math.max(0.6, Math.sqrt(this.stats.spo2.variance));
    }

    // 3. Skin Temperature adaptation
    if (sample.temp >= 35.5 && sample.temp <= 38.0) {
      const tempDiff = sample.temp - this.stats.temp.mean;
      this.stats.temp.mean += alphaMean * tempDiff;
      this.stats.temp.variance = (1 - alphaVar) * this.stats.temp.variance + alphaVar * Math.pow(tempDiff, 2);
      this.stats.temp.std = Math.max(0.18, Math.sqrt(this.stats.temp.variance));
    }

    // 4. Activity adaptation
    const actDiff = sample.activity - this.stats.activity.mean;
    this.stats.activity.mean += alphaMean * actDiff;
    this.stats.activity.variance = (1 - alphaVar) * this.stats.activity.variance + alphaVar * Math.pow(actDiff, 2);
    this.stats.activity.std = Math.max(0.5, Math.sqrt(this.stats.activity.variance));

    return {
      updated: true,
      calibrationProgress: this.getCalibrationProgress()
    };
  }

  /**
   * Expected Heart Rate based on physical exertion level (METs)
   */
  getExpectedHR(activityMETs) {
    const act = Math.max(0, activityMETs);
    // Baseline resting HR + metabolic demand coupling
    return this.stats.hr.restingMean + (act * this.stats.hr.activeExpectedFactor);
  }

  /**
   * Compute standard normal deviations (z-scores) and absolute deltas
   */
  computeDeviations(sample) {
    const expectedHR = this.getExpectedHR(sample.activity);
    const hrDelta = sample.hr - expectedHR;
    const effectiveHrStd = Math.max(4.0, this.stats.hr.std * (1.0 + sample.activity * 0.2));
    const zScoreHR = hrDelta / effectiveHrStd;

    const spo2Delta = sample.spo2 - this.stats.spo2.mean;
    const zScoreSpO2 = spo2Delta / Math.max(0.6, this.stats.spo2.std);

    const tempDelta = sample.temp - this.stats.temp.mean;
    const zScoreTemp = tempDelta / Math.max(0.2, this.stats.temp.std);

    const actDelta = sample.activity - this.stats.activity.mean;
    const zScoreAct = actDelta / Math.max(0.5, this.stats.activity.std);

    return {
      hr: {
        current: sample.hr,
        baselineMean: Math.round(this.stats.hr.mean * 10) / 10,
        expectedHR: Math.round(expectedHR * 10) / 10,
        delta: Math.round(hrDelta * 10) / 10,
        zScore: Math.round(zScoreHR * 100) / 100,
        range: [
          Math.round((this.stats.hr.mean - 2 * this.stats.hr.std) * 10) / 10,
          Math.round((this.stats.hr.mean + 2 * this.stats.hr.std) * 10) / 10
        ]
      },
      spo2: {
        current: sample.spo2,
        baselineMean: Math.round(this.stats.spo2.mean * 10) / 10,
        delta: Math.round(spo2Delta * 10) / 10,
        zScore: Math.round(zScoreSpO2 * 100) / 100,
        range: [
          Math.round(Math.max(88, this.stats.spo2.mean - 2 * this.stats.spo2.std) * 10) / 10,
          100.0
        ]
      },
      temp: {
        current: sample.temp,
        baselineMean: Math.round(this.stats.temp.mean * 100) / 100,
        delta: Math.round(tempDelta * 100) / 100,
        zScore: Math.round(zScoreTemp * 100) / 100,
        range: [
          Math.round((this.stats.temp.mean - 2 * this.stats.temp.std) * 100) / 100,
          Math.round((this.stats.temp.mean + 2 * this.stats.temp.std) * 100) / 100
        ]
      },
      activity: {
        current: sample.activity,
        baselineMean: Math.round(this.stats.activity.mean * 10) / 10,
        delta: Math.round(actDelta * 10) / 10,
        zScore: Math.round(zScoreAct * 100) / 100,
        context: sample.activity < 1.0 ? 'Resting / Sedentary' : (sample.activity < 4.0 ? 'Moderate Movement' : 'Vigorous Exertion')
      }
    };
  }

  /**
   * Calibration percentage (0-100%)
   */
  getCalibrationProgress() {
    if (this.isCalibrated) return 100;
    return Math.min(100, Math.round((this.calibrationTicks / this.options.calibrationWindowTicks) * 100));
  }

  /**
   * Manual freeze toggle
   */
  setFrozen(frozen) {
    this.isFrozen = Boolean(frozen);
  }

  /**
   * Snapshot for serialization or UI
   */
  getSnapshot() {
    return {
      profileKey: this.profileKey,
      isCalibrated: this.isCalibrated,
      isFrozen: this.isFrozen,
      progress: this.getCalibrationProgress(),
      hrRange: [
        Math.round(this.stats.hr.mean - 2 * this.stats.hr.std),
        Math.round(this.stats.hr.mean + 2 * this.stats.hr.std)
      ],
      spo2Range: [
        Math.round(Math.max(88, this.stats.spo2.mean - 2 * this.stats.spo2.std)),
        100
      ],
      tempRange: [
        (this.stats.temp.mean - 2 * this.stats.temp.std).toFixed(1),
        (this.stats.temp.mean + 2 * this.stats.temp.std).toFixed(1)
      ],
      stats: {
        hrMean: Math.round(this.stats.hr.mean * 10) / 10,
        hrStd: Math.round(this.stats.hr.std * 10) / 10,
        spo2Mean: Math.round(this.stats.spo2.mean * 10) / 10,
        spo2Std: Math.round(this.stats.spo2.std * 10) / 10,
        tempMean: Math.round(this.stats.temp.mean * 100) / 100,
        tempStd: Math.round(this.stats.temp.std * 100) / 100
      }
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PersonalBaselineLearner;
}
