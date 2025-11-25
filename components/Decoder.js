"use client";

import { useState, useRef, useEffect } from "react";

export function Decoder() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [morse, setMorse] = useState("");
  const [text, setText] = useState("");
  const [vizData, setVizData] = useState(null);
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith("audio/")) {
        setError("Please select a valid audio file (WAV, MP3, etc.)");
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError("");
      // Reset outputs
      setMorse("");
      setText("");
      setVizData(null);
    }
  };

  const handleDecode = async () => {
    if (!file) {
      setError("Please select an audio file");
      return;
    }

    setLoading(true);
    setError("");
    setMorse("");
    setText("");
    setVizData(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/decode", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to decode audio");
      }

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);
      
      setMorse(data.morse);
      setText(data.text);
      if (data.visualization) {
        setVizData(data.visualization);
      }
    } catch (err) {
      setError(err.message || "An error occurred while decoding");
    } finally {
      setLoading(false);
    }
  };

  // Drawing Logic
  useEffect(() => {
    if (!vizData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();
    
    // Set actual canvas size to match display size for sharpness
    canvas.width = width;
    canvas.height = height;

    const { audio, envelope, threshold } = vizData;
    const len = audio.length;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Helper to map value to Y coordinate
    // Audio is typically +/- 32768 for 16-bit, but we converted to float.
    // Envelope is 0 to ~32768. 
    // We need to normalize based on the max value found in envelope to keep it visible.
    const maxVal = Math.max(
        ...envelope, 
        Math.abs(Math.max(...audio)), 
        Math.abs(Math.min(...audio))
    ) || 1;
    
    // Scale factor (leave 10% padding)
    const scale = (height / 2) * 0.9 / maxVal;
    const centerY = height / 2;

    // 1. Draw Raw Audio (Gray)
    ctx.beginPath();
    ctx.strokeStyle = "#94a3b8"; // slate-400
    ctx.lineWidth = 1;
    for (let i = 0; i < len; i++) {
        const x = (i / len) * width;
        const y = centerY - (audio[i] * scale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Draw Envelope (Blue)
    ctx.beginPath();
    ctx.strokeStyle = "#2563eb"; // blue-600
    ctx.lineWidth = 2;
    for (let i = 0; i < len; i++) {
        const x = (i / len) * width;
        // Envelope is positive, but we draw it "up" from center (or just absolute)
        // Since envelope is magnitude, let's draw it from center up, 
        // effectively overlaying the positive half of the wave
        const y = centerY - (envelope[i] * scale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Draw Threshold (Red Dashed Line)
    // Threshold is a scalar value
    const thresholdY = centerY - (threshold * scale);
    ctx.beginPath();
    ctx.strokeStyle = "#dc2626"; // red-600
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    // Labels
    ctx.fillStyle = "#2563eb";
    ctx.font = "12px sans-serif";
    ctx.fillText("Signal Envelope", 10, 20);
    
    ctx.fillStyle = "#dc2626";
    ctx.fillText("Detection Threshold", 10, 35);

  }, [vizData]);

  const handleClear = () => {
    setFile(null);
    setFileName("");
    setMorse("");
    setText("");
    setError("");
    setVizData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName("");
    setVizData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (content) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white border border-cyan-200 rounded-2xl p-8">
        {/* File Upload Section */}
        <div className="mb-8">
          <label className="block text-lg font-semibold text-slate-900 mb-4">
            Upload Audio File
          </label>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-6 py-8 rounded-lg border-2 border-dashed border-cyan-400 hover:border-cyan-500 bg-slate-50 hover:bg-slate-100 transition-all duration-200 text-center cursor-pointer group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                📁
              </div>
              <p className="text-slate-900 font-semibold">
                {file ? "Change File" : "Choose Audio File"}
              </p>
              <p className="text-slate-600 text-sm mt-1">
                or drag and drop (WAV, MP3, etc.)
              </p>
            </button>
          </div>

          {/* Selected File Display */}
          {file && (
            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div>
                  <p className="text-slate-900 font-medium">{fileName}</p>
                  <p className="text-sm text-slate-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="px-3 py-1 rounded text-sm text-red-600 hover:bg-red-900/20 transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-700">
            {error}
          </div>
        )}

        {/* Signal Visualization Dashboard */}
        {vizData && (
            <div className="mb-8 p-4 rounded-lg bg-slate-50 border border-slate-300">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Signal Analysis Dashboard</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Visualizing filtered audio, envelope detection, and logic threshold.
                </p>
                <div className="w-full h-64 bg-white rounded border border-slate-200 shadow-inner relative">
                    <canvas 
                        ref={canvasRef} 
                        className="w-full h-full block"
                    />
                </div>
            </div>
        )}

        {/* Morse Code Output */}
        {morse && (
          <div className="mb-8 p-6 rounded-lg bg-slate-800 border border-slate-600">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Detected Morse Code</h3>
              <button
                onClick={() => copyToClipboard(morse)}
                className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="font-mono text-lg text-cyan-300 break-words p-4 bg-slate-900 rounded-lg max-h-32 overflow-y-auto">
              {morse}
            </div>
          </div>
        )}

        {/* Text Output */}
        {text && (
          <div className="mb-8 p-6 rounded-lg bg-slate-800 border border-slate-600">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Decoded Text</h3>
              <button
                onClick={() => copyToClipboard(text)}
                className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="text-2xl text-green-300 font-semibold p-4 bg-slate-900 rounded-lg break-words">
              {text}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDecode}
            disabled={loading || !file}
            className="flex-1 min-w-[150px] px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 disabled:cursor-not-allowed text-white"
          >
            {loading ? "Decoding..." : "Decode Audio"}
          </button>
          {(morse || text) && (
            <button
              onClick={handleClear}
              className="flex-1 min-w-[150px] px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-slate-200 hover:bg-slate-300 text-slate-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}