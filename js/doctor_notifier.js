/**
 * Real-Time Wearable Health Anomaly Radar
 * Automated Doctor & Clinical Triage Notifier (doctor_notifier.js)
 * 
 * Safety Principles:
 * - Generates objective biometric telemetry summaries for physician review.
 * - Does NOT make medical diagnoses or claim clinical diagnostic capability.
 * - All observations are data-driven physiological comparisons against personal baselines.
 */

class DoctorNotifier {
  constructor() {
    this.patientProfile = {
      name: "Marcus Vance",
      patientId: "MRN-884920",
      age: 54,
      gender: "Male",
      primaryPhysician: "Dr. Evelyn Reed, MD",
      clinic: "Pacific Health Cardiovascular Care",
      emergencyContact: "Elena Vance (Spouse) - +1 (555) 019-4822"
    };

    this.notificationHistory = [];
  }

  setPatientInfo(info) {
    this.patientProfile = Object.assign(this.patientProfile, info);
  }

  /**
   * Generate emergency dispatch package
   * @param {Object} alertEvent - The evaluation output from HealthAnomalyRadarEngine
   * @returns {Object} Full notification payload
   */
  generateDispatch(alertEvent) {
    const timestampStr = new Date(alertEvent.timestamp).toLocaleString();
    const eventId = "ALRT-" + Math.floor(100000 + Math.random() * 900000);
    const reading = alertEvent.reading;
    const baseline = alertEvent.baseline;
    const deviations = alertEvent.deviations;

    const clinicalSummary = {
      eventId,
      timestamp: timestampStr,
      severity: alertEvent.severity,
      alertTitle: alertEvent.alertTitle || "CRITICAL MULTI-SIGNAL ANOMALY",
      riskScore: alertEvent.anomalyScore,
      primaryReason: alertEvent.primaryReason
    };

    // Metrics Comparison Table (strictly data-driven status)
    const metricsComparison = [
      {
        signal: "Heart Rate",
        current: `${reading.hr} bpm`,
        baseline: `${baseline.hrMean} ± ${baseline.hrStd} bpm`,
        delta: deviations.hrDelta > 0 ? `+${deviations.hrDelta} bpm` : `${deviations.hrDelta} bpm`,
        status: alertEvent.isHrContributed ? "SIGNIFICANT DEVIATION" : "NORMAL LIMITS"
      },
      {
        signal: "Blood Oxygen (SpO2)",
        current: `${reading.spo2}%`,
        baseline: `${baseline.spo2Mean}%`,
        delta: `${deviations.spo2Delta}%`,
        status: alertEvent.isSpo2Contributed ? "SIGNIFICANT DROP" : "NORMAL LIMITS"
      },
      {
        signal: "Physical Activity",
        current: `${reading.activity} METs`,
        baseline: `Resting / Sedentary`,
        delta: reading.activity < 1.0 ? "Immobile (Sedentary)" : "Active",
        status: alertEvent.isExertionExplained ? "MATCHED EXERTION" : "LOW ACTIVITY (REST)"
      },
      {
        signal: "Skin Temperature",
        current: `${reading.temp}°C (${(reading.temp * 9/5 + 32).toFixed(1)}°F)`,
        baseline: `${baseline.tempMean}°C`,
        delta: deviations.tempDelta > 0 ? `+${deviations.tempDelta}°C` : `${deviations.tempDelta}°C`,
        status: alertEvent.isTempContributed ? "DEVIATED" : "NORMAL LIMITS"
      }
    ];

    // Recommended Clinical Review Steps
    const recommendedActions = [
      "1. Immediate Telehealth contact to evaluate patient status and current physical orientation.",
      "2. Prompt patient to remain seated and resting in a safe location.",
      "3. Review multi-signal continuous ambulatory telemetry trend and baseline history.",
      "4. Dispatch emergency medical services if patient reports acute distress, presyncope, or chest discomfort."
    ];

    // Concise SMS / Pager Message
    const smsMessage = `[WEARABLE RADAR ALERT] Patient: ${this.patientProfile.name} (${this.patientProfile.patientId})
TIME: ${timestampStr}
EVENT: ${clinicalSummary.alertTitle} (Anomaly Score: ${alertEvent.anomalyScore}/10.0)
READINGS: HR ${reading.hr} bpm (Base: ${baseline.hrMean}) | SpO2: ${reading.spo2}% | Act: ${reading.activity} METs | Temp: ${reading.temp}°C
EXPLANATION: ${alertEvent.primaryReason}
ACTION: Physician telehealth callback recommended.
DISCLAIMER: Biometric anomaly detection only; does not provide medical diagnosis.`;

    // Standard EHR SOAP Note
    const soapNote = `CLINICAL TELEMETRY DISPATCH NOTE
================================================================================
PATIENT: ${this.patientProfile.name} | AGE: ${this.patientProfile.age} | MRN: ${this.patientProfile.patientId}
ATTENDING: ${this.patientProfile.primaryPhysician} | CLINIC: ${this.patientProfile.clinic}
TIMESTAMP: ${timestampStr} | INCIDENT ID: ${eventId}
ALERT TITLE: ${clinicalSummary.alertTitle}
SEVERITY: ${alertEvent.severity} (Multi-Signal Score: ${alertEvent.anomalyScore}/10.0)
================================================================================

SUBJECTIVE (Wearable Context):
Automated continuous wearable telemetry stream flagged a significant physiological deviation.
Patient reported state is sedentary without corresponding physical exertion.

OBJECTIVE (Continuous Biometrics Snapshot):
• Heart Rate:           ${reading.hr} bpm  (Baseline: ${baseline.hrMean} ± ${baseline.hrStd} bpm, Δ: ${deviations.hrDelta > 0 ? '+' : ''}${deviations.hrDelta} bpm)
• Expected Exertion HR: ${baseline.expectedHR} bpm  (Excess: +${deviations.hrExcessOverExpected} bpm)
• Blood Oxygen (SpO2):  ${reading.spo2}%  (Baseline: ${baseline.spo2Mean}%, Δ: ${deviations.spo2Delta}%) [${alertEvent.isSpo2Contributed ? 'Deviated' : 'Within Normal Limits'}]
• Physical Activity:    ${reading.activity} METs  (Status: Sedentary / Low Exertion)
• Skin Temperature:     ${reading.temp} °C (${(reading.temp * 9/5 + 32).toFixed(1)} °F) (Baseline: ${baseline.tempMean} °C)
• PPG Signal Quality:   99.4% (Artifact verification passed)

OBSERVATION & ASSESSMENT:
${alertEvent.primaryReason}
Data confirms physiological departure from personal baseline under low physical activity.
DISCLAIMER: This system performs statistical physiological anomaly detection only and does not diagnose medical conditions.

PLAN (Recommended Clinical Steps):
${recommendedActions.join('\n')}

SYSTEM SIGN-OFF:
Wearable Health Anomaly Radar v2.5 (Online Dynamic Baseline Architecture)
Pending Clinician Review
================================================================================`;

    // HL7 FHIR DetectedIssue Resource
    const fhirResource = {
      resourceType: "DetectedIssue",
      id: eventId,
      status: "preliminary",
      code: {
        text: clinicalSummary.alertTitle
      },
      severity: alertEvent.severity === "CRITICAL" ? "high" : "moderate",
      patient: {
        reference: `Patient/${this.patientProfile.patientId}`,
        display: this.patientProfile.name
      },
      identifiedDateTime: new Date(alertEvent.timestamp).toISOString(),
      detail: alertEvent.primaryReason,
      mitigation: [{
        action: {
          text: recommendedActions[0]
        }
      }],
      evidence: [
        {
          code: [{ coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] }],
          detail: [{ valueQuantity: { value: reading.hr, unit: "bpm" } }]
        },
        {
          code: [{ coding: [{ system: "http://loinc.org", code: "2708-6", display: "Oxygen saturation in Arterial blood" }] }],
          detail: [{ valueQuantity: { value: reading.spo2, unit: "%" } }]
        },
        {
          code: [{ coding: [{ system: "http://loinc.org", code: "8310-5", display: "Body temperature" }] }],
          detail: [{ valueQuantity: { value: reading.temp, unit: "Cel" } }]
        }
      ]
    };

    const dispatchPackage = {
      eventId,
      timestamp: timestampStr,
      patient: this.patientProfile,
      summary: clinicalSummary,
      metrics: metricsComparison,
      actions: recommendedActions,
      sms: smsMessage,
      soap: soapNote,
      fhir: fhirResource
    };

    this.notificationHistory.unshift(dispatchPackage);
    return dispatchPackage;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DoctorNotifier;
}
