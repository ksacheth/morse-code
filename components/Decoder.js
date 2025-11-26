"use client";

import { useState, useRef, useEffect } from "react";

export default function Decoder() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDecode = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/decode", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Decoding failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (result && result.visualization && canvasRef.current) {
      // Debug: log clustering data
      console.log("Clustering OFF data:", result.visualization.clustering?.off);
      console.log(
        "Word spaces (label=2):",
        result.visualization.clustering?.off?.filter((d) => d.label === 2)
      );
      drawVisualization(result.visualization);
    }
  }, [result]);

  const drawVisualization = (vizData) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.fillRect(0, 0, width, height);

    const rowHeight = height / 3;
    const padding = 30;
    const leftMargin = 60;
    const usableWidth = width - leftMargin - 20;

    // --- Row 1: Analog Signal (Audio + Envelope) ---
    ctx.save();
    ctx.translate(0, 0);

    // Background for row
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, rowHeight);

    // Label (larger and bold)
    ctx.fillStyle = "#e0f2fe"; // cyan-100
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("1. Signal Processing (Raw & Envelope)", leftMargin, 25);

    // Draw Y-axis scale labels
    ctx.fillStyle = "#64748b";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText("1", leftMargin - 5, rowHeight * 0.15);
    ctx.fillText("0", leftMargin - 5, rowHeight * 0.5);
    ctx.fillText("-1", leftMargin - 5, rowHeight * 0.85);

    // Draw Y-axis line
    ctx.beginPath();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.moveTo(leftMargin, padding);
    ctx.lineTo(leftMargin, rowHeight - padding);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * (rowHeight - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw Audio Waveform with fill
    const audioData = vizData.audio || [];
    const step = usableWidth / audioData.length;
    const centerY = rowHeight / 2;

    // Fill under audio waveform
    ctx.beginPath();
    ctx.moveTo(leftMargin, centerY);
    audioData.forEach((val, i) => {
      const x = leftMargin + i * step;
      const y = centerY + val * -1 * (rowHeight / 2 - padding) * 0.7;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(leftMargin + audioData.length * step, centerY);
    ctx.fillStyle = "rgba(96, 165, 250, 0.15)"; // blue with transparency
    ctx.fill();

    // Draw Audio Waveform line
    ctx.beginPath();
    ctx.strokeStyle = "#06b6d4"; // cyan-500
    ctx.lineWidth = 1.5;
    audioData.forEach((val, i) => {
      const x = leftMargin + i * step;
      const y = centerY + val * -1 * (rowHeight / 2 - padding) * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Envelope with fill
    const envelopeData = vizData.envelope || [];
    ctx.beginPath();
    ctx.moveTo(leftMargin, rowHeight - padding);
    envelopeData.forEach((val, i) => {
      const x = leftMargin + i * step;
      const y = rowHeight - padding - val * (rowHeight - 2 * padding);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(leftMargin + envelopeData.length * step, rowHeight - padding);
    ctx.fillStyle = "rgba(251, 191, 36, 0.2)"; // amber with transparency
    ctx.fill();

    // Draw Envelope line
    ctx.beginPath();
    ctx.strokeStyle = "#fbbf24"; // amber-400
    ctx.lineWidth = 2.5;
    envelopeData.forEach((val, i) => {
      const x = leftMargin + i * step;
      const y = rowHeight - padding - val * (rowHeight - 2 * padding);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Threshold
    const threshold = vizData.threshold || 0;
    const thresholdY =
      rowHeight - padding - threshold * (rowHeight - 2 * padding);
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444"; // red-500
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.moveTo(leftMargin, thresholdY);
    ctx.lineTo(width - 20, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threshold label
    ctx.fillStyle = "#ef4444";
    ctx.font = "10px sans-serif";
    ctx.fillText("Threshold", leftMargin + 5, thresholdY - 5);

    ctx.restore();

    // --- Row 2: Digital Signal (Square Wave) ---
    ctx.save();
    ctx.translate(0, rowHeight);

    // Background for row
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, rowHeight);

    // Separator
    ctx.beginPath();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#e0f2fe";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("2. Digitization (Square Wave)", leftMargin, 25);

    // Draw Y-axis scale labels
    ctx.fillStyle = "#64748b";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText("1", leftMargin - 5, rowHeight * 0.15 + rowHeight);
    ctx.fillText("0", leftMargin - 5, rowHeight * 0.85 + rowHeight);

    // Draw Y-axis line
    ctx.beginPath();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.moveTo(leftMargin, padding);
    ctx.lineTo(leftMargin, rowHeight - padding);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * (rowHeight - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw square wave
    ctx.beginPath();
    ctx.strokeStyle = "#10b981"; // emerald-500
    ctx.lineWidth = 2.5;
    const squareData = vizData.square || [];
    const sqStep = usableWidth / squareData.length;

    squareData.forEach((val, i) => {
      const x = leftMargin + i * sqStep;
      const y = rowHeight - padding - val * (rowHeight - 2 * padding);
      if (i === 0) ctx.moveTo(x, y);
      else {
        // Draw square edges
        const prevY =
          rowHeight - padding - squareData[i - 1] * (rowHeight - 2 * padding);
        ctx.lineTo(x, prevY); // Horizontal to new X
        ctx.lineTo(x, y); // Vertical to new Y
      }
    });
    ctx.stroke();

    // Fill under square wave
    ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
    ctx.beginPath();
    ctx.moveTo(leftMargin, rowHeight - padding);
    squareData.forEach((val, i) => {
      const x = leftMargin + i * sqStep;
      const y = rowHeight - padding - val * (rowHeight - 2 * padding);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(leftMargin + squareData.length * sqStep, rowHeight - padding);
    ctx.fill();

    ctx.restore();

    // --- Row 3: Clustering (Durations) with Timeline ---
    ctx.save();
    ctx.translate(0, rowHeight * 2);

    // Background for row
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, rowHeight);

    // Separator
    ctx.beginPath();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#e0f2fe";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("3. Clustering (Symbol Classification)", leftMargin, 25);

    const clustering = vizData.clustering || { on: [], off: [] };

    // Find max duration to scale X axis dynamically, with minimum of 25000
    const allDurs = [...clustering.on, ...clustering.off].map(
      (d) => d.duration
    );
    const maxDur = Math.max(...allDurs, 25000);

    // Draw timeline X-axis
    ctx.beginPath();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.moveTo(leftMargin, rowHeight - 30);
    ctx.lineTo(width - 20, rowHeight - 30);
    ctx.stroke();

    // Draw X-axis tick marks and labels
    ctx.fillStyle = "#64748b";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i <= 5; i++) {
      const x = leftMargin + (i / 5) * usableWidth;
      const val = Math.round((i / 5) * maxDur);

      // Tick mark
      ctx.beginPath();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.moveTo(x, rowHeight - 30);
      ctx.lineTo(x, rowHeight - 25);
      ctx.stroke();

      // Label
      ctx.fillText(val, x, rowHeight - 10);
    }

    // Draw grid lines for timeline
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    for (let i = 1; i < 5; i++) {
      const x = leftMargin + (i / 5) * usableWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding + 40);
      ctx.lineTo(x, rowHeight - 35);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Plot ON durations (Dots/Dashes) - Top
    const onY = rowHeight * 0.3;
    const onLabelX = leftMargin - 50;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("ON", onLabelX, onY + 5);

    // Group ON items by label to find cluster centers
    const dotDurations = clustering.on
      .filter((d) => d.label === ".")
      .map((d) => d.duration);
    const dashDurations = clustering.on
      .filter((d) => d.label === "-")
      .map((d) => d.duration);

    // Calculate cluster centers for ON
    const dotCenter =
      dotDurations.length > 0
        ? dotDurations.reduce((a, b) => a + b, 0) / dotDurations.length
        : 0;
    const dashCenter =
      dashDurations.length > 0
        ? dashDurations.reduce((a, b) => a + b, 0) / dashDurations.length
        : 0;

    // Draw cluster boundary line for ON (midpoint between dot and dash centers)
    if (dotDurations.length > 0 && dashDurations.length > 0) {
      const boundary = (dotCenter + dashCenter) / 2;
      const boundaryX = leftMargin + (boundary / maxDur) * usableWidth;
      ctx.beginPath();
      ctx.strokeStyle = "#8b5cf6"; // purple
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.moveTo(boundaryX, onY - 25);
      ctx.lineTo(boundaryX, onY + 25);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = "#8b5cf6";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("boundary", boundaryX, onY - 30);
    }

    // Draw ON points with vertical jitter to avoid overlap
    clustering.on.forEach((item, index) => {
      const x = leftMargin + (item.duration / maxDur) * usableWidth;
      const isDot = item.label === ".";
      const color = isDot ? "#06b6d4" : "#0ea5e9"; // cyan vs sky blue
      const size = isDot ? 5 : 8;

      // Add jitter based on index to spread overlapping points
      const jitter = ((index % 5) - 2) * 6;

      // Draw circle
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, onY + jitter, size, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw legend for ON
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#06b6d4";
    ctx.fillText("● Dot", leftMargin + 5, onY - 35);
    ctx.fillStyle = "#0ea5e9";
    ctx.fillText("● Dash", leftMargin + 50, onY - 35);

    // Plot OFF durations (Spaces) - Bottom
    const offY = rowHeight * 0.7;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("OFF", onLabelX, offY + 5);

    // Group OFF items by label to find cluster centers
    const intraDurations = clustering.off
      .filter((d) => d.label === 0)
      .map((d) => d.duration);
    const letterDurations = clustering.off
      .filter((d) => d.label === 1)
      .map((d) => d.duration);
    const wordDurations = clustering.off
      .filter((d) => d.label === 2)
      .map((d) => d.duration);

    // Calculate cluster centers for OFF
    const intraCenter =
      intraDurations.length > 0
        ? intraDurations.reduce((a, b) => a + b, 0) / intraDurations.length
        : 0;
    const letterCenter =
      letterDurations.length > 0
        ? letterDurations.reduce((a, b) => a + b, 0) / letterDurations.length
        : 0;
    const wordCenter =
      wordDurations.length > 0
        ? wordDurations.reduce((a, b) => a + b, 0) / wordDurations.length
        : 0;

    // Draw cluster boundary lines for OFF
    const offCenters = [
      { center: intraCenter, count: intraDurations.length },
      { center: letterCenter, count: letterDurations.length },
      { center: wordCenter, count: wordDurations.length },
    ]
      .filter((c) => c.count > 0)
      .sort((a, b) => a.center - b.center);

    for (let i = 0; i < offCenters.length - 1; i++) {
      const boundary = (offCenters[i].center + offCenters[i + 1].center) / 2;
      const boundaryX = leftMargin + (boundary / maxDur) * usableWidth;
      ctx.beginPath();
      ctx.strokeStyle = "#8b5cf6"; // purple
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.moveTo(boundaryX, offY - 20);
      ctx.lineTo(boundaryX, offY + 20);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw OFF points with vertical jitter
    clustering.off.forEach((item, index) => {
      const x = leftMargin + (item.duration / maxDur) * usableWidth;
      let color = "#94a3b8"; // gray for intra-character (0)

      if (item.label === 1) {
        color = "#f59e0b"; // amber for letter space
      } else if (item.label === 2) {
        color = "#ef4444"; // red for word space
      }

      const size = 5;

      // Add jitter based on index to spread overlapping points
      const jitter = ((index % 5) - 2) * 5;

      // Draw circle
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, offY + jitter, size, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw legend for OFF
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("● Intra", leftMargin + 5, offY - 30);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("● Letter", leftMargin + 50, offY - 30);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("● Word", leftMargin + 100, offY - 30);

    // X-Axis label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Duration (samples)", width / 2, rowHeight - 5);

    ctx.restore();
  };

  return (
    <>
      <div className="w-full max-w-2xl mx-auto px-4 space-y-8">
        <div className="p-6 bg-white rounded-xl shadow-md space-y-6">
          <h2 className="text-2xl font-bold text-gray-800">Audio Decoder</h2>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer bg-gray-50"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              accept=".wav,.mp3"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="space-y-2">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600 hover:text-blue-500">
                    Upload a file
                  </span>{" "}
                  or drag and drop
                </div>
                <p className="text-xs text-gray-500">WAV or MP3 up to 10MB</p>
              </div>
            </label>
            {file && (
              <p className="mt-4 text-sm font-medium text-green-600">
                Selected: {file.name}
              </p>
            )}
          </div>

          <button
            onClick={handleDecode}
            disabled={loading || !file}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Decoding..." : "Decode Audio"}
          </button>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
          )}

          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Detected Morse
                  </h3>
                  <p className="font-mono text-lg text-gray-900 break-all">
                    {result.morse}
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.morse)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="text-sm font-medium text-green-800 mb-2">
                    Translated Text
                  </h3>
                  <p className="text-lg text-gray-900">{result.text}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.text)}
                    className="mt-2 text-xs text-green-700 hover:text-green-900 font-medium cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Signal Analysis
              </h3>
              <div className="overflow-x-auto bg-gray-900 rounded">
                <canvas
                  ref={canvasRef}
                  width={1600}
                  height={500}
                  className="w-full h-auto"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-xs text-gray-600">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-cyan-500 mr-2 rounded-full"></span>
                  Audio
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-amber-400 mr-2 rounded-full"></span>
                  Envelope
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-emerald-500 mr-2 rounded-full"></span>
                  Digital
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-cyan-400 mr-2 rounded-full"></span>
                  Dot (ON)
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-sky-400 mr-2 rounded-full"></span>
                  Dash (ON)
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-slate-400 mr-2 rounded-full"></span>
                  Intra (OFF)
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-amber-500 mr-2 rounded-full"></span>
                  Letter (OFF)
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-red-500 mr-2 rounded-full"></span>
                  Word (OFF)
                </div>
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 bg-red-500 mr-2"
                    style={{ borderTop: "2px dashed" }}
                  ></span>
                  Threshold
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
