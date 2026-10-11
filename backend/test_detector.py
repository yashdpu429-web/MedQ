"""
Real-Time Wearable Health Anomaly Radar
Backend Test Suite (test_detector.py)
"""

import time
import pytest
from .models import SensorPayload
from .detector import AnomalyDetector
from .baseline import OnlineBaselineLearner

def test_baseline_learning():
    baseline = OnlineBaselineLearner("standard")
    initial_mean = baseline.stats["hr_mean"]
    
    # Adapt with lower HR
    for _ in range(15):
        baseline.update(hr=68.0, spo2=98.5, temp=36.6, activity=0.4, is_anomalous=False)
        
    assert baseline.stats["hr_mean"] < initial_mean

def test_exertion_gating_workout():
    detector = AnomalyDetector()
    sample = SensorPayload(
        hr=155.0,
        spo2=97.5,
        activity=8.5,
        temp=37.3,
        ingest_timestamp=time.time() * 1000
    )
    res = detector.evaluate_payload(sample)
    assert res.severity == "NORMAL"
    assert res.is_exertion_explained is True

def test_silent_cardiac_spike():
    detector = AnomalyDetector()
    sample = SensorPayload(
        hr=162.0,
        spo2=98.0,
        activity=0.2,
        temp=36.7,
        ingest_timestamp=time.time() * 1000
    )
    # Consecutive ticks
    for _ in range(3):
        res = detector.evaluate_payload(sample)
    assert res.severity == "CRITICAL"
    assert res.anomaly_type == "CARDIAC_SPIKE"

def test_acute_hypoxia():
    detector = AnomalyDetector()
    sample = SensorPayload(
        hr=120.0,
        spo2=86.0,
        activity=0.3,
        temp=36.8,
        ingest_timestamp=time.time() * 1000
    )
    for _ in range(3):
        res = detector.evaluate_payload(sample)
    assert res.severity == "CRITICAL"
    assert res.anomaly_type == "ACUTE_HYPOXIA"

def test_baseline_contamination_guard():
    detector = AnomalyDetector()
    initial_hr_mean = detector.baseline_learner.stats["hr_mean"]
    
    # Inject emergency spike
    spike = SensorPayload(
        hr=165.0,
        spo2=98.0,
        activity=0.2,
        temp=36.7,
        ingest_timestamp=time.time() * 1000
    )
    for _ in range(5):
        detector.evaluate_payload(spike)
        
    assert detector.baseline_learner.stats["hr_mean"] == initial_hr_mean

if __name__ == "__main__":
    test_baseline_learning()
    test_exertion_gating_workout()
    test_silent_cardiac_spike()
    test_acute_hypoxia()
    test_baseline_contamination_guard()
    print("All backend detector tests passed successfully!")
