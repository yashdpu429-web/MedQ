"""
Real-Time Wearable Health Anomaly Radar
SQLite Persistence Layer (database.py)
"""

import sqlite3
import json
import os
from typing import List, Dict, Any

DB_FILE = os.path.join(os.path.dirname(__file__), "telemetry_radar.db")

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            timestamp REAL,
            severity TEXT,
            anomaly_type TEXT,
            anomaly_score REAL,
            suspected_condition TEXT,
            clinical_reason TEXT,
            latency_ms REAL,
            status TEXT,
            reading_json TEXT
        )
    """)
    conn.commit()
    conn.close()

def save_event(event_data: Dict[str, Any]):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""
        INSERT OR REPLACE INTO events 
        (id, timestamp, severity, anomaly_type, anomaly_score, suspected_condition, clinical_reason, latency_ms, status, reading_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event_data.get("event_id"),
        event_data.get("timestamp"),
        event_data.get("severity"),
        event_data.get("anomaly_type"),
        event_data.get("anomaly_score"),
        event_data.get("suspected_condition"),
        event_data.get("clinical_reason"),
        event_data.get("detection_latency_ms"),
        event_data.get("status", "UNACKNOWLEDGED"),
        json.dumps(event_data.get("reading", {}))
    ))
    conn.commit()
    conn.close()

def get_recent_events(limit: int = 50) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, timestamp, severity, anomaly_type, anomaly_score, suspected_condition, clinical_reason, latency_ms, status, reading_json FROM events ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "event_id": r[0],
            "timestamp": r[1],
            "severity": r[2],
            "anomaly_type": r[3],
            "anomaly_score": r[4],
            "suspected_condition": r[5],
            "clinical_reason": r[6],
            "detection_latency_ms": r[7],
            "status": r[8],
            "reading": json.loads(r[9]) if r[9] else {}
        })
    return result
