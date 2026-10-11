"""
Real-Time Wearable Health Anomaly Radar
Clinical Multi-Signal Anomaly Detector (detector.py)
"""

import time
import numpy as np
from typing import Dict, Any, List, Optional
from .baseline import OnlineBaselineLearner
from .models import SensorPayload, AnomalyEvaluation, AlertEvent

class AnomalyDetector:
    def __init__(self, warning_thresh: float = 4.5, critical_thresh: float = 7.0, persistence_window: int = 2):
        self.warning_thresh = warning_thresh
        self.critical_thresh = critical_thresh
        self.persistence_window = persistence_window
        self.hysteresis_recovery_ticks = 6

        self.baseline_learner = OnlineBaselineLearner("standard")
        self.consecutive_high_ticks = 0
        self.consecutive_normal_ticks = 0
        self.active_alert: Optional[AlertEvent] = None
        self.event_counter = 1000
        self.audit_log: List[AlertEvent] = []

    def evaluate_payload(self, payload: SensorPayload) -> AnomalyEvaluation:
        t_start = time.time()
        ingest_ts = payload.ingest_timestamp or (time.time() * 1000)

        # 1. Deviations
        stats = self.baseline_learner.stats
        expected_hr = self.baseline_learner.get_expected_hr(payload.activity)
        hr_excess = payload.hr - stats["hr_mean"]

        # Z-scores
        effective_hr_std = max(4.0, stats["hr_std"] * (1.0 + payload.activity * 0.2))
        z_hr = (payload.hr - expected_hr) / effective_hr_std
        z_spo2 = (stats["spo2_mean"] - payload.spo2) / max(0.6, stats["spo2_std"])
        z_temp = abs(payload.temp - stats["temp_mean"]) / max(0.2, stats["temp_std"])

        score = 0.0
        anomaly_type = "NORMAL"
        suspected_condition = "Homeostasis"
        clinical_reason = "Physiological vitals within normal expected bounds."
        contributing_factors = []
        is_exertion_explained = False

        # Syndrome A: Silent Resting Tachycardia
        if payload.hr >= 130.0 and payload.activity <= 1.2:
            rest_bonus = max(0.0, 1.2 - payload.activity) / 1.2
            cardiac_score = min(10.0, (hr_excess / 10.0) * (1.2 + rest_bonus * 0.8))
            if cardiac_score > score:
                score = cardiac_score
                anomaly_type = "CARDIAC_SPIKE"
                suspected_condition = "Paroxysmal Tachycardia / Acute Arrhythmia"
                clinical_reason = f"Heart rate ({payload.hr} bpm) is substantially above resting baseline while activity remains low ({payload.activity} METs)."
                contributing_factors.append(f"Resting tachycardia (+{round(hr_excess)} bpm)")
                contributing_factors.append("Low metabolic exertion mismatch")

        # Syndrome B: Acute Hypoxia + Compensatory Tachycardia
        if payload.spo2 < 93.0:
            hypox_delta = 95.0 - payload.spo2
            tachy_comp = max(0.0, (payload.hr - stats["hr_mean"]) / 18.0)
            hypox_score = min(10.0, (hypox_delta * 1.35) + tachy_comp + (3.0 if payload.spo2 < 88 else 0))
            if hypox_score > score:
                score = hypox_score
                anomaly_type = "ACUTE_HYPOXIA"
                suspected_condition = "Acute Hypoxemia / Respiratory Distress"
                clinical_reason = f"Critical desaturation (SpO2 {payload.spo2}%) with elevated heart rate ({payload.hr} bpm)."
                contributing_factors.append(f"Arterial desaturation ({payload.spo2}%)")
                contributing_factors.append("Compensatory tachycardia")

        # Syndrome C: Septic Hyperthermia
        if payload.temp >= 38.3:
            fever_excess = (payload.temp - 37.0) * 3.8
            tachy_part = max(0.0, (payload.hr - stats["hr_mean"]) / 14.0)
            septic_score = min(10.0, fever_excess + tachy_part)
            if septic_score > score:
                score = septic_score
                anomaly_type = "SEPTIC_HYPERTHERMIC"
                suspected_condition = "Systemic Hyperthermia / Suspected Sepsis Triad"
                clinical_reason = f"High fever ({payload.temp}°C) accompanied by elevated resting heart rate ({payload.hr} bpm)."
                contributing_factors.append(f"Pyrexia ({payload.temp}°C)")

        # Syndrome D: Exertion Gating (The Workout Filter)
        if payload.activity >= 3.5 and payload.spo2 >= 93.0:
            if abs(payload.hr - expected_hr) < 35.0:
                is_exertion_explained = True
                score = min(2.4, score * 0.2)
                anomaly_type = "PHYSIOLOGICAL_EXERTION"
                suspected_condition = "Normal Exercise Homeostasis"
                clinical_reason = f"High heart rate ({payload.hr} bpm) is fully matched with physical exertion ({payload.activity} METs). False alarm suppressed."
                contributing_factors = ["Metabolically matched exertion"]

        # Temporal persistence & hysteresis
        if score >= self.critical_thresh:
            self.consecutive_high_ticks += 1
            self.consecutive_normal_ticks = 0
        elif score >= self.warning_thresh:
            self.consecutive_high_ticks += 1
            self.consecutive_normal_ticks = 0
        else:
            self.consecutive_normal_ticks += 1
            self.consecutive_high_ticks = max(0, self.consecutive_high_ticks - 1)

        is_persistent = self.consecutive_high_ticks >= self.persistence_window or score >= 8.5
        severity = "NORMAL"
        if score >= self.critical_thresh and is_persistent:
            severity = "CRITICAL"
        elif score >= self.warning_thresh and is_persistent:
            severity = "WARNING"
        elif score >= 2.5:
            severity = "ELEVATED"

        # Safe baseline update (frozen on anomaly)
        is_anom = severity in ["CRITICAL", "WARNING"] or score >= 4.0
        self.baseline_learner.update(payload.hr, payload.spo2, payload.temp, payload.activity, is_anom)

        # Latency calculation
        t_finish = time.time()
        detection_latency_ms = max(1.0, round((time.time() * 1000) - ingest_ts, 2))

        # Alert lifecycle & duplicate suppression
        if severity in ["CRITICAL", "WARNING"]:
            if not self.active_alert:
                self.event_counter += 1
                self.active_alert = AlertEvent(
                    event_id=f"EVT-{self.event_counter}",
                    timestamp=payload.timestamp,
                    time_formatted=time.strftime("%H:%M:%S", time.localtime(payload.timestamp / 1000)),
                    severity=severity,
                    anomaly_type=anomaly_type,
                    anomaly_score=round(score, 1),
                    suspected_condition=suspected_condition,
                    clinical_reason=clinical_reason,
                    contributing_factors=contributing_factors,
                    detection_latency_ms=detection_latency_ms,
                    reading=payload.model_dump()
                )
                self.audit_log.insert(0, self.active_alert)
            else:
                self.active_alert.duration_sec += 1
                self.active_alert.anomaly_score = max(self.active_alert.anomaly_score, round(score, 1))
        elif self.active_alert and self.consecutive_normal_ticks >= self.hysteresis_recovery_ticks:
            # Recovery detected
            self.active_alert.status = "RESOLVED"
            self.active_alert = None

        return AnomalyEvaluation(
            timestamp=payload.timestamp,
            severity=severity,
            anomaly_type=anomaly_type,
            anomaly_score=round(score, 1),
            suspected_condition=suspected_condition,
            clinical_reason=clinical_reason,
            contributing_factors=contributing_factors,
            is_exertion_explained=is_exertion_explained,
            detection_latency_ms=detection_latency_ms,
            reading=payload
        )
