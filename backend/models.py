"""
Real-Time Wearable Health Anomaly Radar
Data Models & Schemas (models.py)
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import time

class SensorPayload(BaseModel):
    timestamp: float = Field(default_factory=lambda: time.time() * 1000)
    ingest_timestamp: float = Field(default_factory=lambda: time.time() * 1000)
    hr: float = Field(..., ge=20.0, le=260.0, description="Heart rate in beats per minute")
    spo2: float = Field(..., ge=50.0, le=100.0, description="Blood oxygen saturation percentage")
    activity: float = Field(..., ge=0.0, le=20.0, description="Physical exertion in METs")
    temp: float = Field(..., ge=30.0, le=45.0, description="Core/Skin temperature in Celsius")
    signal_quality: Optional[float] = Field(default=99.2, ge=0.0, le=100.0)

class BaselineSnapshot(BaseModel):
    profile_id: str
    hr_mean: float
    hr_std: float
    spo2_mean: float
    temp_mean: float
    is_frozen: bool = False
    calibration_progress: float = 100.0

class AnomalyEvaluation(BaseModel):
    timestamp: float
    severity: str  # NORMAL, ELEVATED, WARNING, CRITICAL
    anomaly_type: str
    anomaly_score: float = Field(..., ge=0.0, le=10.0)
    suspected_condition: str
    clinical_reason: str
    contributing_factors: List[str]
    is_exertion_explained: bool
    detection_latency_ms: float
    reading: SensorPayload

class AlertEvent(BaseModel):
    event_id: str
    timestamp: float
    time_formatted: str
    severity: str
    anomaly_type: str
    anomaly_score: float
    suspected_condition: str
    clinical_reason: str
    contributing_factors: List[str]
    detection_latency_ms: float
    status: str = "UNACKNOWLEDGED"
    duration_sec: int = 1
    reading: Dict[str, Any]

class DoctorNotification(BaseModel):
    alert_id: str
    recipient: str
    institution: str
    timestamp_str: str
    sms_text: str
    soap_note: Dict[str, Any]
    fhir_resource: Dict[str, Any]
    delivery_status: str
