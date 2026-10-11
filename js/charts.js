/**
 * Real-Time Wearable Health Anomaly Radar
 * Canvas Visualizations & Healthcare Telemetry Charts (charts.js)
 * 
 * Styled specifically for Premium Light Healthcare SaaS Aesthetic:
 * - Crisp High-DPI canvas rendering
 * - Multi-signal time series with 1m / 5m / 1h range selectors
 * - Interactive channel isolation (toggling HR, SpO2, Activity, Temp)
 * - Visible anomaly markers & highlighted alert windows
 * - 4 Sparklines for live vital cards
 * - 2D Phase-Space Exertion Corridor (HR vs METs)
 * - Multi-axis Anomaly Radar Decomposition
 * - Real-time Lead-I ECG strip
 */

class HealthRadarCharts {
  constructor(canvasMap = {}) {
    this.canvases = canvasMap;
    this.telemetryHistory = [];
    this.maxHistory = 180; // 180 points for 1m / 3m range
    this.ecgHistory = [];
    this.maxEcgPoints = 280;

    // Time range selection: 60 (1m), 180 (3m), or 600 (extended)
    this.selectedTimeRangeSec = 60;

    // Channel visibility for multi-signal telemetry
    this.visibleChannels = {
      hr: true,
      spo2: true,
      activity: true,
      temp: true
    };

    // Color tokens matching the exact requested healthcare palette
    this.colors = {
      bgSurface: '#FFFFFF',
      gridLine: '#E9EEF4',
      border: '#DFE6EF',
      textMain: '#182338',
      textSecondary: '#64748B',
      accentTeal: '#168C83',
      secondaryBlue: '#4776B9',
      warningAmber: '#E5A33D',
      criticalRed: '#D9364F',
      hrLine: '#D9364F',        // Heart Rate Coral
      spo2Line: '#168C83',      // SpO2 Medical Teal
      activityLine: '#4776B9',  // Activity Sky Blue
      tempLine: '#E5A33D'       // Temperature Amber
    };
  }

  setTimeRange(seconds) {
    this.selectedTimeRangeSec = seconds;
  }

  toggleChannel(channelKey) {
    if (this.visibleChannels[channelKey] !== undefined) {
      this.visibleChannels[channelKey] = !this.visibleChannels[channelKey];
    }
  }

  pushTelemetry(sample, evaluation) {
    this.telemetryHistory.push({
      timestamp: sample.timestamp,
      reading: sample,
      evaluation: evaluation,
      isAnomaly: evaluation && (evaluation.severity === 'CRITICAL' || evaluation.severity === 'WARNING'),
      severity: evaluation ? evaluation.severity : 'NORMAL'
    });

    if (this.telemetryHistory.length > this.maxHistory) {
      this.telemetryHistory.shift();
    }
  }

  pushECG(voltage) {
    this.ecgHistory.push(voltage);
    if (this.ecgHistory.length > this.maxEcgPoints) {
      this.ecgHistory.shift();
    }
  }

  /**
   * Helper to set canvas dimensions respecting devicePixelRatio
   */
  _setupCanvas(canvas) {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.resetTransform && ctx.resetTransform();
    ctx.scale(dpr, dpr);
    return { ctx, width: rect.width, height: rect.height };
  }

  /**
   * 1. Render Sparklines for the 4 live vital cards
   */
  renderSparkline(canvasId, key, color, minVal, maxVal) {
    const canvas = document.getElementById(canvasId);
    const env = this._setupCanvas(canvas);
    if (!env || this.telemetryHistory.length < 2) return;
    const { ctx, width, height } = env;

    ctx.clearRect(0, 0, width, height);

    // Filter points for sparkline (last 20 points)
    const points = this.telemetryHistory.slice(-25);
    const stepX = width / (points.length - 1);

    // Shaded gradient under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(1, color + '00');

    ctx.beginPath();
    points.forEach((pt, i) => {
      const val = pt.reading[key];
      const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
      const x = i * stepX;
      const y = height - 4 - norm * (height - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Fill area
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Pulse dot at latest point
    const latest = points[points.length - 1];
    const latestNorm = Math.max(0, Math.min(1, (latest.reading[key] - minVal) / (maxVal - minVal)));
    const dotX = width;
    const dotY = height - 4 - latestNorm * (height - 8);

    ctx.beginPath();
    ctx.arc(dotX - 2, dotY, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * 2. Render Main Multi-Signal Telemetry Chart
   */
  renderMainTelemetryChart() {
    const canvas = this.canvases.mainTelemetry || document.getElementById('canvas-main-telemetry');
    const env = this._setupCanvas(canvas);
    if (!env) return;
    const { ctx, width, height } = env;

    // Clean white surface
    ctx.fillStyle = this.colors.bgSurface;
    ctx.fillRect(0, 0, width, height);

    const pad = { top: 20, right: 30, bottom: 35, left: 55 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Subtle horizontal gridlines
    ctx.strokeStyle = this.colors.gridLine;
    ctx.lineWidth = 1;
    const gridRows = 5;
    for (let i = 0; i <= gridRows; i++) {
      const y = pad.top + (plotH / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }

    if (this.telemetryHistory.length < 2) {
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Awaiting live biometric stream telemetry...', pad.left + 20, pad.top + plotH / 2);
      return;
    }

    // Determine slice based on selected time range
    const sliceCount = Math.min(this.telemetryHistory.length, Math.max(20, this.selectedTimeRangeSec));
    const dataSlice = this.telemetryHistory.slice(-sliceCount);
    const stepX = plotW / (dataSlice.length - 1);

    // Visible Anomaly Highlight Bands & Markers
    dataSlice.forEach((item, i) => {
      if (item.isAnomaly) {
        const x = pad.left + i * stepX;
        const bandColor = item.severity === 'CRITICAL' ? 'rgba(217, 54, 79, 0.12)' : 'rgba(229, 163, 61, 0.12)';
        ctx.fillStyle = bandColor;
        ctx.fillRect(Math.max(pad.left, x - stepX / 2), pad.top, stepX, plotH);

        // Anomaly vertical indicator tick at top
        ctx.fillStyle = item.severity === 'CRITICAL' ? this.colors.criticalRed : this.colors.warningAmber;
        ctx.fillRect(x - 1.5, pad.top, 3, 8);
      }
    });

    // Active channels config
    const channels = [
      { key: 'hr', name: 'Heart Rate', color: this.colors.hrLine, min: 40, max: 200, unit: 'bpm', active: this.visibleChannels.hr },
      { key: 'spo2', name: 'SpO2', color: this.colors.spo2Line, min: 70, max: 100, unit: '%', active: this.visibleChannels.spo2 },
      { key: 'activity', name: 'Activity', color: this.colors.activityLine, min: 0, max: 10, unit: 'METs', active: this.visibleChannels.activity },
      { key: 'temp', name: 'Skin Temp', color: this.colors.tempLine, min: 34, max: 41, unit: '°C', active: this.visibleChannels.temp }
    ];

    // Left Y-axis labels (normalized for primary Heart Rate scale)
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridRows; i++) {
      const val = Math.round(200 - (160 / gridRows) * i);
      const y = pad.top + (plotH / gridRows) * i;
      ctx.fillText(`${val}`, pad.left - 8, y + 3);
    }
    ctx.textAlign = 'left';

    // Draw lines for each active channel
    channels.forEach(ch => {
      if (!ch.active) return;

      ctx.beginPath();
      dataSlice.forEach((item, i) => {
        const val = item.reading[ch.key];
        const norm = Math.max(0, Math.min(1, (val - ch.min) / (ch.max - ch.min)));
        const x = pad.left + i * stepX;
        const y = pad.top + plotH - norm * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.strokeStyle = ch.color;
      ctx.lineWidth = ch.key === 'hr' ? 2.4 : 1.8;
      ctx.stroke();

      // End value bubble
      const latest = dataSlice[dataSlice.length - 1];
      const latestVal = latest.reading[ch.key];
      const latestNorm = Math.max(0, Math.min(1, (latestVal - ch.min) / (ch.max - ch.min)));
      const endX = pad.left + plotW;
      const endY = pad.top + plotH - latestNorm * plotH;

      ctx.beginPath();
      ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = ch.color;
      ctx.fill();
    });

    // Time axis labels
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '10px Inter, sans-serif';
    const timeStepCount = 4;
    for (let t = 0; t <= timeStepCount; t++) {
      const index = Math.floor((dataSlice.length - 1) * (t / timeStepCount));
      const pt = dataSlice[index];
      if (pt) {
        const x = pad.left + index * stepX;
        const timeStr = new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        ctx.fillText(timeStr, x - 22, height - 12);
      }
    }
  }

  /**
   * 3. Render 2D Phase-Space Exertion Corridor (Heart Rate vs Physical Exertion)
   * Clinical evaluation demonstration:
   * Shows why (HR 160, METs 8) is inside the physiological envelope,
   * while (HR 160, METs 0) leaps into the upper-left Silent Cardiac Danger Zone.
   */
  renderPhaseSpaceCorridor(latestSample, latestEvaluation) {
    const canvas = this.canvases.phaseSpace || document.getElementById('canvas-phase-space');
    const env = this._setupCanvas(canvas);
    if (!env || !latestSample) return;
    const { ctx, width, height } = env;

    ctx.fillStyle = this.colors.bgSurface;
    ctx.fillRect(0, 0, width, height);

    const pad = { top: 25, right: 25, bottom: 40, left: 45 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Coordinate mapping functions
    const mapX = (act) => pad.left + (Math.max(0, Math.min(10, act)) / 10) * plotW;
    const mapY = (hr) => pad.top + plotH - ((Math.max(40, Math.min(200, hr)) - 40) / 160) * plotH;

    // Grid lines
    ctx.strokeStyle = this.colors.gridLine;
    ctx.lineWidth = 1;
    for (let act = 0; act <= 10; act += 2) {
      const x = mapX(act);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`${act}`, x - 4, pad.top + plotH + 16);
    }
    for (let hr = 50; hr <= 190; hr += 35) {
      const y = mapY(hr);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`${hr}`, 12, y + 4);
    }

    // Axis titles
    ctx.fillStyle = this.colors.textMain;
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText('PHYSICAL EXERTION (METs)', pad.left + plotW / 2 - 60, height - 8);

    // 1. DANGER ZONE: Upper-Left (Resting + Tachycardia)
    ctx.fillStyle = 'rgba(217, 54, 79, 0.08)';
    ctx.fillRect(mapX(0), mapY(200), mapX(2.0) - mapX(0), mapY(130) - mapY(200));

    ctx.strokeStyle = 'rgba(217, 54, 79, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(mapX(0), mapY(200), mapX(2.0) - mapX(0), mapY(130) - mapY(200));
    ctx.setLineDash([]);

    ctx.fillStyle = this.colors.criticalRed;
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillText('DANGER: SILENT CARDIAC SPIKE', mapX(0.2), mapY(190));

    // 2. NORMAL PHYSIOLOGICAL CORRIDOR (The Green/Teal Envelope)
    ctx.beginPath();
    ctx.moveTo(mapX(0), mapY(55));
    ctx.lineTo(mapX(2), mapY(65));
    ctx.lineTo(mapX(6), mapY(120));
    ctx.lineTo(mapX(10), mapY(175));
    ctx.lineTo(mapX(10), mapY(195));
    ctx.lineTo(mapX(6), mapY(155));
    ctx.lineTo(mapX(2), mapY(100));
    ctx.lineTo(mapX(0), mapY(90));
    ctx.closePath();

    ctx.fillStyle = 'rgba(22, 140, 131, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(22, 140, 131, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = this.colors.accentTeal;
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Healthy Exertion Envelope', mapX(4.5), mapY(125));

    // Plot recent trail
    const trail = this.telemetryHistory.slice(-15);
    if (trail.length > 1) {
      ctx.beginPath();
      trail.forEach((pt, i) => {
        const tx = mapX(pt.reading.activity);
        const ty = mapY(pt.reading.hr);
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      });
      ctx.strokeStyle = 'rgba(38, 56, 88, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Current Operating Point
    const curX = mapX(latestSample.activity);
    const curY = mapY(latestSample.hr);
    const isCritical = latestEvaluation && latestEvaluation.severity === 'CRITICAL';
    const pointColor = isCritical ? this.colors.criticalRed : this.colors.accentTeal;

    // Glowing indicator ring
    ctx.beginPath();
    ctx.arc(curX, curY, isCritical ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = isCritical ? 'rgba(217, 54, 79, 0.25)' : 'rgba(22, 140, 131, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fillStyle = pointColor;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * 4. Multi-Axis Anomaly Radar Decomposition
   * Shows contributions: HR excess, SpO2 deficit, Exertion mismatch, Temp shift
   */
  renderRadarDecomposition(evaluation) {
    const canvas = this.canvases.radarDecomposition || document.getElementById('canvas-radar-decomposition');
    const env = this._setupCanvas(canvas);
    if (!env || !evaluation) return;
    const { ctx, width, height } = env;

    ctx.fillStyle = this.colors.bgSurface;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 34;

    const axes = [
      { name: 'Heart Rate Excess', key: 'hr', color: this.colors.criticalRed },
      { name: 'SpO2 Desaturation', key: 'spo2', color: this.colors.accentTeal },
      { name: 'Activity Mismatch', key: 'activity', color: this.colors.secondaryBlue },
      { name: 'Temperature Shift', key: 'temp', color: this.colors.warningAmber }
    ];

    const numAxes = axes.length;
    const angleStep = (Math.PI * 2) / numAxes;

    // Concentric web rings
    ctx.strokeStyle = this.colors.gridLine;
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1.0].forEach(level => {
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * (radius * level);
        const y = centerY + Math.sin(angle) * (radius * level);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // Spoke lines and labels
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const endX = centerX + Math.cos(angle) * radius;
      const endY = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Label text
      const labelX = centerX + Math.cos(angle) * (radius + 20);
      const labelY = centerY + Math.sin(angle) * (radius + 15);
      ctx.fillStyle = this.colors.textMain;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(axis.name, labelX, labelY);
    });

    // Compute normalized values for each axis (0.0 to 1.0)
    const dev = evaluation.deviations || {};
    const values = [
      Math.min(1.0, Math.max(0, (dev.hr ? dev.hr.zScore : 0) / 4.0)),
      Math.min(1.0, Math.max(0, (dev.spo2 ? -dev.spo2.zScore : 0) / 4.0)),
      evaluation.isExertionExplained ? 0.1 : (evaluation.reading.activity < 1.0 && evaluation.reading.hr > 110 ? 0.9 : 0.2),
      Math.min(1.0, Math.max(0, (dev.temp ? Math.abs(dev.temp.zScore) : 0) / 3.0))
    ];

    // Filled polygon representing current anomaly footprint
    ctx.beginPath();
    values.forEach((val, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const clampedVal = Math.max(0.08, val);
      const x = centerX + Math.cos(angle) * (radius * clampedVal);
      const y = centerY + Math.sin(angle) * (radius * clampedVal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    const isHigh = evaluation.severity === 'CRITICAL';
    ctx.fillStyle = isHigh ? 'rgba(217, 54, 79, 0.25)' : 'rgba(22, 140, 131, 0.22)';
    ctx.fill();
    ctx.strokeStyle = isHigh ? this.colors.criticalRed : this.colors.accentTeal;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * 5. Real-Time ECG Lead-I Continuous Strip
   */
  renderECGStrip(hr, severity) {
    const canvas = this.canvases.ecg || document.getElementById('canvas-ecg');
    const env = this._setupCanvas(canvas);
    if (!env) return;
    const { ctx, width, height } = env;

    // Clean white surface with subtle medical grid
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Medical ECG millimeter grid
    ctx.strokeStyle = 'rgba(71, 118, 185, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 18;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (this.ecgHistory.length < 2) return;

    // Waveform line color
    let traceColor = this.colors.accentTeal;
    if (severity === 'CRITICAL') traceColor = this.colors.criticalRed;
    else if (severity === 'WARNING') traceColor = this.colors.warningAmber;

    ctx.strokeStyle = traceColor;
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    const midY = height * 0.52;
    const scaleY = height * 0.36;
    const stepX = width / this.maxEcgPoints;

    for (let i = 0; i < this.ecgHistory.length; i++) {
      const x = i * stepX;
      const y = midY - (this.ecgHistory[i] * scaleY);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Clinical banner overlay
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '10px Inter, monospace';
    ctx.fillText(`LEAD I • 25 mm/s • 10 mm/mV • Current: ${Math.round(hr)} bpm`, 12, 16);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthRadarCharts;
}
