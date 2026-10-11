/**
 * Real-Time Wearable Health Anomaly Radar
 * Core Anomaly Detection Engine (anomaly_engine.js)
 * 
 * Safety & Regulatory Principles:
 * - This system detects biometric deviations from an individual's personal baseline.
 * - NEVER provides or implies medical diagnoses.
 * - Evaluates multi-signal data-driven deviations transparently.
 */

class HealthAnomalyRadarEngine {
  constructor(options = {}) {
    this.options = Object.assign({
      learningRateMean: 0.04,
      learningRateVar: 0.02,
      calibrationDurationSec: 15,
      alertThresholdWarning: 4.5,
      alertThresholdCritical: 7.0,
      persistenceWindow: 2,
      cooldownPeriodSec: 8
    }, options);

    // Baseline stats for each physiological metric
    this.baseline = {
      hr: { mean: 72.0, variance: 36.0, std: 6.0, min: 55, max: 95 },
      spo2: { mean: 98.2, variance: 1.0, std: 1.0, min: 95, max: 100 },
      temp: { mean: 36.6, variance: 0.15, std: 0.38, min: 36.1, max: 37.2 },
      activity: { mean: 1.2, variance: 1.5, std: 1.22, min: 0.0, max: 3.5 }
    };

    // Tracking state
    this.totalSamples = 0;
    this.isCalibrated = false;
    this.calibrationSamples = 0;
    this.requiredCalibrationSamples = this.options.calibrationDurationSec;

    // Temporal smoothing and persistence
    this.consecutiveHighScores = 0;
    this.activeAlert = null;
    this.recentHistory = [];
    this.maxHistory = 120;
    this.lastAlertTime = null;
  }

  /**
   * Set patient profile baseline presets
   */
  setProfile(profileType) {
    if (profileType === 'athlete') {
      this.baseline.hr = { mean: 50.0, variance: 25.0, std: 5.0, min: 42, max: 70 };
      this.baseline.spo2 = { mean: 99.0, variance: 0.8, std: 0.89, min: 96, max: 100 };
      this.baseline.temp = { mean: 36.5, variance: 0.12, std: 0.35, min: 36.0, max: 37.1 };
      this.baseline.activity = { mean: 2.5, variance: 3.0, std: 1.73, min: 0.0, max: 6.0 };
    } else if (profileType === 'elderly_copd') {
      this.baseline.hr = { mean: 78.0, variance: 40.0, std: 6.3, min: 65, max: 95 };
      this.baseline.spo2 = { mean: 93.5, variance: 1.5, std: 1.22, min: 90, max: 96 };
      this.baseline.temp = { mean: 36.4, variance: 0.15, std: 0.38, min: 35.9, max: 37.0 };
      this.baseline.activity = { mean: 0.8, variance: 0.8, std: 0.89, min: 0.0, max: 2.0 };
    } else {
      this.baseline.hr = { mean: 72.0, variance: 36.0, std: 6.0, min: 58, max: 90 };
      this.baseline.spo2 = { mean: 98.2, variance: 1.0, std: 1.0, min: 95, max: 100 };
      this.baseline.temp = { mean: 36.6, variance: 0.15, std: 0.38, min: 36.1, max: 37.2 };
      this.baseline.activity = { mean: 1.2, variance: 1.5, std: 1.22, min: 0.0, max: 3.5 };
    }
    this.totalSamples = 0;
    this.calibrationSamples = 0;
    this.isCalibrated = false;
    this.consecutiveHighScores = 0;
    this.activeAlert = null;
  }

  /**
   * Process incoming health reading frame
   * @param {Object} sample - { hr, spo2, activity, temp, timestamp }
   * @returns {Object} Evaluation result with anomaly scores, classification, and diagnostics
   */
  processReading(sample) {
    this.totalSamples++;
    const timestamp = sample.timestamp || Date.now();

    // 1. Online Baseline Learning (Unsupervised)
    const isCalibrating = this.calibrationSamples < this.requiredCalibrationSamples;
    if (isCalibrating) {
      this.calibrationSamples++;
      this._updateBaselineOnline(sample, 0.15);
      if (this.calibrationSamples >= this.requiredCalibrationSamples) {
        this.isCalibrated = true;
      }
    }

    // 2. Compute Contextual Physiological Expectations
    const expectedHR = this._calculateExpectedHR(sample.activity);
    const hrExcessOverExpected = sample.hr - expectedHR;
    
    // Effective standard deviation considering exertion noise
    const effectiveHrStd = Math.max(4.0, this.baseline.hr.std * (1.0 + sample.activity * 0.25));
    const zScoreHR = hrExcessOverExpected / effectiveHrStd;
    
    // SpO2 desaturation score
    const spo2Delta = this.baseline.spo2.mean - sample.spo2;
    let zScoreSpO2 = 0;
    // SpO2 is considered significantly abnormal ONLY if it drops substantially below baseline
    const isSpo2SignificantlyAbnormal = sample.spo2 < 93.0 || spo2Delta >= 3.5;
    if (spo2Delta > 0) {
      const baseZ = spo2Delta / Math.max(0.8, this.baseline.spo2.std);
      const hypoxiaWeight = sample.spo2 < 90 ? 2.5 : (sample.spo2 < 93 ? 1.8 : 1.0);
      zScoreSpO2 = baseZ * hypoxiaWeight;
    }

    // Temperature deviation
    const tempDelta = Math.abs(sample.temp - this.baseline.temp.mean);
    const isTempSignificantlyAbnormal = tempDelta >= 0.8 || sample.temp >= 38.0;
    const zScoreTemp = tempDelta / Math.max(0.2, this.baseline.temp.std);

    // Heart rate abnormal check
    const isHrSignificantlyAbnormal = (sample.hr > this.baseline.hr.mean + 28 && sample.activity <= 1.5) ||
                                      (sample.hr < 45 && this.baseline.hr.mean > 60);

    // 3. Multi-Signal Pattern Analysis (Non-diagnostic biometric departure)
    const activeDeviations = [];
    if (isHrSignificantlyAbnormal) {
      if (sample.hr > this.baseline.hr.mean) {
        activeDeviations.push(`Heart rate is significantly elevated (+${Math.round(sample.hr - this.baseline.hr.mean)} bpm above baseline)`);
      } else {
        activeDeviations.push(`Heart rate is significantly depressed (-${Math.round(this.baseline.hr.mean - sample.hr)} bpm below baseline)`);
      }
    }
    if (isSpo2SignificantlyAbnormal) {
      activeDeviations.push(`Blood oxygen (SpO2) is reduced to ${sample.spo2.toFixed(1)}% (baseline ${this.baseline.spo2.mean.toFixed(1)}%)`);
    }
    if (isTempSignificantlyAbnormal) {
      activeDeviations.push(`Skin temperature is deviated to ${sample.temp.toFixed(1)}°C (baseline ${this.baseline.temp.mean.toFixed(1)}°C)`);
    }

    // Check exertion context
    const isExertionExplained = sample.activity >= 4.0 && Math.abs(sample.hr - expectedHR) < (2.5 * effectiveHrStd) && sample.spo2 >= 94;

    // 4. Multi-Signal Severity Calculation
    let rawAnomalyScore = 0;
    let anomalyClassification = 'NORMAL';
    let alertTitle = 'NORMAL PHYSIOLOGICAL HOMEOSTASIS';
    let dataDrivenExplanation = 'Significant deviation from the individual\'s personalized baseline detected.';

    // Mode A: Multi-Signal Concurrent Anomaly (HR elevated + SpO2 dropped + Low Activity)
    if (isHrSignificantlyAbnormal && isSpo2SignificantlyAbnormal && sample.activity <= 1.5) {
      // Compound multi-signal penalty: multiple signals together increase anomaly severity
      const hrComponent = Math.min(6.5, (sample.hr - this.baseline.hr.mean) / 10.0 * 1.2);
      const spo2Component = Math.min(5.5, (95 - sample.spo2) * 0.8);
      const tempComponent = isTempSignificantlyAbnormal ? 1.5 : 0.0;
      rawAnomalyScore = Math.min(10.0, 4.0 + hrComponent + spo2Component + tempComponent);
      anomalyClassification = 'MULTI_SIGNAL_EMERGENCY';
      alertTitle = 'CRITICAL MULTI-SIGNAL ANOMALY';
      dataDrivenExplanation = `Significant deviation from the individual's personalized baseline detected: Multiple physiological signals deviating concurrently — heart rate is significantly above personal baseline while blood oxygen (SpO2: ${sample.spo2.toFixed(1)}%) is decreased and physical activity remains low (${sample.activity.toFixed(1)} METs).`;
    }
    // Mode B: Heart Rate Spike at Rest (HR elevated, SpO2 normal, Low Activity)
    else if (sample.hr > (this.baseline.hr.mean + 32) && sample.activity <= 1.5) {
      const excess = sample.hr - this.baseline.hr.mean;
      rawAnomalyScore = Math.min(9.5, 6.0 + (excess / 14.0));
      anomalyClassification = 'ELEVATED_HEART_RATE_SPIKE';
      alertTitle = 'CRITICAL MULTI-SIGNAL ANOMALY';
      // Strictly data-driven: HR is high, activity is low, SpO2 is NOT blamed
      dataDrivenExplanation = `Significant deviation from the individual's personalized baseline detected: Heart rate is significantly above personal baseline while physical activity remains low (${sample.activity.toFixed(1)} METs). Blood oxygen (${sample.spo2.toFixed(1)}%) remains within normal range.`;
    }
    // Mode C: Acute Oxygen Desaturation alone (SpO2 dropped, Low Activity)
    else if (isSpo2SignificantlyAbnormal) {
      const spo2Severity = Math.min(9.5, 6.0 + (93 - sample.spo2) * 0.6);
      rawAnomalyScore = Math.max(rawAnomalyScore, spo2Severity);
      anomalyClassification = 'OXYGEN_DESATURATION';
      alertTitle = 'CRITICAL MULTI-SIGNAL ANOMALY';
      dataDrivenExplanation = `Significant deviation from the individual's personalized baseline detected: Blood oxygen (SpO2) dropped to ${sample.spo2.toFixed(1)}% (below personal baseline of ${this.baseline.spo2.mean.toFixed(1)}%) while physical activity is low.`;
    }
    // Mode D: Severe Bradycardia (Marked HR depression)
    else if (sample.hr < 45 && this.baseline.hr.mean > 60) {
      rawAnomalyScore = Math.min(9.0, 5.5 + (50 - sample.hr) / 3.0);
      anomalyClassification = 'MARKED_HEART_RATE_DEPRESSION';
      alertTitle = 'CRITICAL MULTI-SIGNAL ANOMALY';
      dataDrivenExplanation = `Significant deviation from the individual's personalized baseline detected: Heart rate has dropped significantly below personalized baseline to ${sample.hr} bpm during resting state.`;
    }

    // Check physiological workout
    if (isExertionExplained) {
      rawAnomalyScore = Math.min(2.5, Math.abs(zScoreHR) * 0.4);
      anomalyClassification = 'PHYSIOLOGICAL_EXERTION';
      alertTitle = 'PHYSIOLOGICAL EXERTION (NORMAL)';
      dataDrivenExplanation = `Elevated heart rate (${sample.hr} bpm) is fully matched with measured physical exertion (${sample.activity.toFixed(1)} METs). No alert triggered.`;
    } else if (rawAnomalyScore === 0) {
      const generalizedDistance = Math.sqrt(
        Math.pow(Math.max(0, zScoreHR), 2) * 1.0 +
        Math.pow(zScoreSpO2, 2) * 1.2 +
        Math.pow(zScoreTemp, 2) * 0.8
      );
      rawAnomalyScore = Math.min(10, generalizedDistance);
      if (rawAnomalyScore > 4.5) {
        alertTitle = 'MULTI-SIGNAL ANOMALY DETECTED';
        dataDrivenExplanation = `Significant deviation from the individual's personalized baseline detected across monitored channels.`;
      } else {
        dataDrivenExplanation = 'All monitored physiological parameters remain within personalized baseline envelope.';
      }
    }

    // 5. Temporal Persistence Filter
    if (rawAnomalyScore >= this.options.alertThresholdCritical) {
      if (rawAnomalyScore >= 8.0) {
        this.consecutiveHighScores = Math.max(this.consecutiveHighScores + 1, this.options.persistenceWindow);
      } else {
        this.consecutiveHighScores++;
      }
    } else if (rawAnomalyScore >= this.options.alertThresholdWarning) {
      this.consecutiveHighScores++;
    } else {
      this.consecutiveHighScores = Math.max(0, this.consecutiveHighScores - 1);
    }

    // Determine Alert Severity
    let severity = 'NORMAL';
    const isPersistent = this.consecutiveHighScores >= 2;

    if (rawAnomalyScore >= this.options.alertThresholdCritical && isPersistent) {
      severity = 'CRITICAL';
    } else if (rawAnomalyScore >= this.options.alertThresholdWarning && this.consecutiveHighScores >= 2) {
      severity = 'WARNING';
      if (alertTitle === 'NORMAL PHYSIOLOGICAL HOMEOSTASIS') {
        alertTitle = 'WARNING: PHYSIOLOGICAL ANOMALY DETECTED';
      }
    } else if (rawAnomalyScore >= 2.5 && !isExertionExplained) {
      severity = 'ELEVATED';
      alertTitle = 'ELEVATED BASELINE DEVIATION';
    }

    // Update baseline during normal non-calibrating states
    if (severity === 'NORMAL' && !isCalibrating) {
      this._updateBaselineOnline(sample, this.options.learningRateMean);
    }

    // Construct evaluation output
    const result = {
      timestamp,
      reading: { ...sample },
      baseline: {
        hrMean: Math.round(this.baseline.hr.mean * 10) / 10,
        hrStd: Math.round(this.baseline.hr.std * 10) / 10,
        spo2Mean: Math.round(this.baseline.spo2.mean * 10) / 10,
        tempMean: Math.round(this.baseline.temp.mean * 10) / 10,
        expectedHR: Math.round(expectedHR * 10) / 10
      },
      deviations: {
        hrDelta: Math.round((sample.hr - this.baseline.hr.mean) * 10) / 10,
        hrExcessOverExpected: Math.round(hrExcessOverExpected * 10) / 10,
        spo2Delta: Math.round((sample.spo2 - this.baseline.spo2.mean) * 10) / 10,
        tempDelta: Math.round((sample.temp - this.baseline.temp.mean) * 10) / 10,
        zScoreHR: Math.round(zScoreHR * 100) / 100,
        zScoreSpO2: Math.round(zScoreSpO2 * 100) / 100,
        zScoreTemp: Math.round(zScoreTemp * 100) / 100
      },
      anomalyScore: Math.round(Math.min(10, Math.max(0, rawAnomalyScore)) * 10) / 10,
      severity,
      alertTitle: severity === 'CRITICAL' ? 'CRITICAL MULTI-SIGNAL ANOMALY' : alertTitle,
      anomalyClassification,
      primaryReason: dataDrivenExplanation,
      isExertionExplained,
      isSpo2Contributed: isSpo2SignificantlyAbnormal,
      isHrContributed: isHrSignificantlyAbnormal,
      isTempContributed: isTempSignificantlyAbnormal,
      isCalibrated: this.isCalibrated
    };

    this.recentHistory.push(result);
    if (this.recentHistory.length > this.maxHistory) {
      this.recentHistory.shift();
    }

    return result;
  }

  _calculateExpectedHR(activityLevel) {
    const restingHR = this.baseline.hr.mean;
    const exerciseSlope = 11.5;
    const expectedHR = restingHR + Math.pow(Math.max(0, activityLevel), 1.12) * exerciseSlope;
    return Math.min(195, expectedHR);
  }

  _updateBaselineOnline(sample, alpha) {
    if (sample.activity <= 2.0) {
      const hrDiff = sample.hr - this.baseline.hr.mean;
      this.baseline.hr.mean += alpha * hrDiff;
      this.baseline.hr.variance = (1 - alpha * 0.5) * this.baseline.hr.variance + (alpha * 0.5) * (hrDiff * hrDiff);
      this.baseline.hr.std = Math.sqrt(Math.max(4.0, this.baseline.hr.variance));
    }

    if (sample.spo2 >= 94) {
      const spo2Diff = sample.spo2 - this.baseline.spo2.mean;
      this.baseline.spo2.mean += (alpha * 0.5) * spo2Diff;
      this.baseline.spo2.variance = (1 - alpha * 0.3) * this.baseline.spo2.variance + (alpha * 0.3) * (spo2Diff * spo2Diff);
      this.baseline.spo2.std = Math.sqrt(Math.max(0.6, this.baseline.spo2.variance));
    }

    if (sample.temp >= 35.8 && sample.temp <= 37.6) {
      const tempDiff = sample.temp - this.baseline.temp.mean;
      this.baseline.temp.mean += (alpha * 0.3) * tempDiff;
      this.baseline.temp.variance = (1 - alpha * 0.2) * this.baseline.temp.variance + (alpha * 0.2) * (tempDiff * tempDiff);
      this.baseline.temp.std = Math.sqrt(Math.max(0.1, this.baseline.temp.variance));
    }
  }

  reset() {
    this.totalSamples = 0;
    this.calibrationSamples = 0;
    this.isCalibrated = false;
    this.consecutiveHighScores = 0;
    this.activeAlert = null;
    this.recentHistory = [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthAnomalyRadarEngine;
}
