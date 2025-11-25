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
      drawVisualization(result.visualization);
    }
  }, [result]);

  const drawVisualization = (vizData) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw Audio Waveform
    ctx.beginPath();
    ctx.strokeStyle = "#93c5fd"; // blue-300
    ctx.lineWidth = 1;
    const audioData = vizData.audio || [];
    const step = width / audioData.length;

    audioData.forEach((val, i) => {
      const x = i * step;
      const y = (1 - val) * (height / 2); // Normalize roughly
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Envelope
    ctx.beginPath();
    ctx.strokeStyle = "#2563eb"; // blue-600
    ctx.lineWidth = 2;
    const envelopeData = vizData.envelope || [];

    envelopeData.forEach((val, i) => {
      const x = i * step;
      const y = (1 - val) * (height / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Threshold
    const threshold = vizData.threshold || 0;
    const thresholdY = (1 - threshold) * (height / 2);
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444"; // red-500
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md space-y-6">
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

          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Signal Analysis
            </h3>
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full h-auto bg-gray-900 rounded"
            />
            <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-300 mr-1"></span> Audio
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-600 mr-1"></span> Envelope
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-red-500 mr-1"></span> Threshold
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
