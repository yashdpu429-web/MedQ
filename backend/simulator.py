"""
Real-Time Wearable Health Anomaly Radar
Stream Simulator (simulator.py)
"""

import time
import numpy as np
from typing import Dict, Any
from .models import SensorPayload

class StreamSimulator:
    SCENARIOS = {
        "normal_resting": {"hr": 72.0, "spo2": 98.4, "activity": 0.4, "temp": 36.6, "quality": 99.4},
        "exercise_workout": {"hr": 154.0, "spo2": 97.4, "activity": 8.4, "temp": 37.3, "quality": 96.0},
        "cardiac_spike": {"hr": 162.0, "spo2": 97.8, "activity": 0.2, "temp": 36.7, "quality": 98.8},
        "hypoxia_distress": {"hr": 124.0, "spo2": 86.0, "activity": 0.3, "temp": 36.8, "quality": 97.5},
        "sensor_noise": {"hr": 98.0, "spo2": 74.0, "activity": 7.2, "temp": 36.5, "quality": 42.0},
        "recovery": {"hr": 71.0, "spo2": 98.5, "activity": 0.5, "temp": 36.6, "quality": 99.5}
    }

    def __init__(self):
        self.current_scenario = "normal_resting"
        self.current_hr = 72.0
        self.current_spo2 = 98.4
        self.current_activity = 0.5
        self.current_temp = 36.6

    def set_scenario(self, scenario_key: str):
        if scenario_key in self.SCENARIOS:
            self.current_scenario = scenario_key

    def generate_tick(self) -> SensorPayload:
        target = self.SCENARIOS.get(self.current_scenario, self.SCENARIOS["normal_resting"])
        smooth = 0.35
        self.current_hr += (target["hr"] - self.current_hr) * smooth
        self.current_spo2 += (target["spo2"] - self.current_spo2) * smooth
        self.current_activity += (target["activity"] - self.current_activity) * smooth
        self.current_temp += (target["temp"] - self.current_temp) * smooth

        # Noise
        hr_jitter = (np.random.rand() - 0.5) * 1.5
        now_ms = time.time() * 1000

        return SensorPayload(
            timestamp=now_ms,
            ingest_timestamp=now_ms,
            hr=round(float(self.current_hr + hr_jitter), 1),
            spo2=round(float(self.current_spo2), 1),
            activity=round(float(self.current_activity), 1),
            temp=round(float(self.current_temp), 2),
            signal_quality=float(target["quality"])
        )
