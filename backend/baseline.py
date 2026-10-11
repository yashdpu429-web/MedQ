"""
Real-Time Wearable Health Anomaly Radar
Online Baseline Tracker (baseline.py)
"""

import numpy as np
from typing import Dict, Any

class OnlineBaselineLearner:
    def __init__(self, profile_key: str = "standard", learning_rate: float = 0.035):
        self.learning_rate = learning_rate
        self.profile_key = profile_key
        self.is_frozen = False
        self.total_samples = 0
        self.calibration_samples = 0
        self.required_calibration = 15

        self.profiles = {
            "standard": {
                "hr_mean": 72.0, "hr_std": 6.0,
                "spo2_mean": 98.4, "spo2_std": 0.8,
                "temp_mean": 36.6, "temp_std": 0.25,
                "activity_mean": 0.6, "activity_std": 0.8
            },
            "athlete": {
                "hr_mean": 48.0, "hr_std": 5.2,
                "spo2_mean": 99.0, "spo2_std": 0.6,
                "temp_mean": 36.5, "temp_std": 0.22,
                "activity_mean": 1.8, "activity_std": 2.2
            },
            "elderly_copd": {
                "hr_mean": 79.0, "hr_std": 6.8,
                "spo2_mean": 93.2, "spo2_std": 1.2,
                "temp_mean": 36.4, "temp_std": 0.28,
                "activity_mean": 0.4, "activity_std": 0.5
            }
        }

        self.stats = {}
        self.load_profile(profile_key)

    def load_profile(self, profile_key: str):
        p = self.profiles.get(profile_key, self.profiles["standard"])
        self.profile_key = profile_key
        self.stats = {
            "hr_mean": float(p["hr_mean"]),
            "hr_var": float(p["hr_std"] ** 2),
            "hr_std": float(p["hr_std"]),
            "spo2_mean": float(p["spo2_mean"]),
            "spo2_var": float(p["spo2_std"] ** 2),
            "spo2_std": float(p["spo2_std"]),
            "temp_mean": float(p["temp_mean"]),
            "temp_var": float(p["temp_std"] ** 2),
            "temp_std": float(p["temp_std"]),
            "activity_mean": float(p["activity_mean"]),
            "activity_var": float(p["activity_std"] ** 2),
            "activity_std": float(p["activity_std"])
        }
        self.total_samples = 0
        self.calibration_samples = 0
        self.is_frozen = False

    def get_expected_hr(self, activity_mets: float) -> float:
        # Expected HR = resting baseline + metabolic rising factor
        return self.stats["hr_mean"] + (max(0.0, activity_mets) * 11.5)

    def update(self, hr: float, spo2: float, temp: float, activity: float, is_anomalous: bool = False):
        self.total_samples += 1
        if self.calibration_samples < self.required_calibration:
            self.calibration_samples += 1

        # SAFETY GATE: Freeze baseline on anomaly to prevent contamination
        if self.is_frozen or is_anomalous:
            return False

        alpha = 0.12 if self.calibration_samples < self.required_calibration else self.learning_rate

        # Update HR only during low activity to avoid tracking workouts as resting baseline
        if activity <= 1.5:
            diff_hr = hr - self.stats["hr_mean"]
            self.stats["hr_mean"] += alpha * diff_hr
            self.stats["hr_var"] = (1 - alpha) * self.stats["hr_var"] + alpha * (diff_hr ** 2)
            self.stats["hr_std"] = max(3.5, np.sqrt(self.stats["hr_var"]))

        if spo2 >= 92.0:
            diff_spo2 = spo2 - self.stats["spo2_mean"]
            self.stats["spo2_mean"] += alpha * diff_spo2
            self.stats["spo2_var"] = (1 - alpha) * self.stats["spo2_var"] + alpha * (diff_spo2 ** 2)
            self.stats["spo2_std"] = max(0.6, np.sqrt(self.stats["spo2_var"]))

        if 35.5 <= temp <= 38.0:
            diff_temp = temp - self.stats["temp_mean"]
            self.stats["temp_mean"] += alpha * diff_temp
            self.stats["temp_var"] = (1 - alpha) * self.stats["temp_var"] + alpha * (diff_temp ** 2)
            self.stats["temp_std"] = max(0.18, np.sqrt(self.stats["temp_var"]))

        return True

    def get_snapshot(self) -> Dict[str, Any]:
        return {
            "profile_key": self.profile_key,
            "is_frozen": self.is_frozen,
            "calibration_progress": min(100.0, (self.calibration_samples / self.required_calibration) * 100.0),
            "hr_mean": round(self.stats["hr_mean"], 1),
            "hr_std": round(self.stats["hr_std"], 1),
            "spo2_mean": round(self.stats["spo2_mean"], 1),
            "spo2_std": round(self.stats["spo2_std"], 1),
            "temp_mean": round(self.stats["temp_mean"], 2),
            "temp_std": round(self.stats["temp_std"], 2)
        }
