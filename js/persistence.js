/**
 * Real-Time Wearable Health Anomaly Radar
 * Local Persistence & Audit Log Storage (persistence.js)
 */

class HealthPersistenceLayer {
  constructor() {
    this.EVENTS_KEY = 'health_radar_events_v2';
    this.SETTINGS_KEY = 'health_radar_settings_v2';
  }

  saveEvent(event) {
    try {
      const events = this.getEvents();
      // Avoid duplicate by ID
      const existingIdx = events.findIndex(e => e.id === event.id);
      if (existingIdx >= 0) {
        events[existingIdx] = event;
      } else {
        events.unshift(event);
      }
      // Cap at 100 historical events
      const trimmed = events.slice(0, 100);
      localStorage.setItem(this.EVENTS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn("Storage write error:", e);
    }
  }

  getEvents() {
    try {
      const data = localStorage.getItem(this.EVENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  acknowledgeEvent(eventId) {
    const events = this.getEvents();
    const target = events.find(e => e.id === eventId);
    if (target) {
      target.status = 'ACKNOWLEDGED';
      localStorage.setItem(this.EVENTS_KEY, JSON.stringify(events));
    }
    return target;
  }

  clearEvents() {
    localStorage.removeItem(this.EVENTS_KEY);
  }

  saveSettings(settings) {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Settings write error:", e);
    }
  }

  getSettings() {
    try {
      const data = localStorage.getItem(this.SETTINGS_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  exportAuditJSON() {
    return JSON.stringify(this.getEvents(), null, 2);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthPersistenceLayer;
}
