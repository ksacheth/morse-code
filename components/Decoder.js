"use client";

import { useState, useRef } from "react";

export function Decoder() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [morse, setMorse] = useState("");
  const [text, setText] = useState("");
  const fileInputRef = useRef(null);

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
      setMorse(data.morse);
      setText(data.text);
    } catch (err) {
      setError(err.message || "An error occurred while decoding");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setFileName("");
    setMorse("");
    setText("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (content) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-cyan-900/20 via-slate-800/20 to-slate-900/20 border border-cyan-500/30 rounded-2xl p-8 backdrop-blur-sm">
        {/* File Upload Section */}
        <div className="mb-8">
          <label className="block text-lg font-semibold text-white mb-4">
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
              className="w-full px-6 py-8 rounded-lg border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/50 bg-slate-800/30 hover:bg-slate-800/50 transition-all duration-200 text-center cursor-pointer group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                📁
              </div>
              <p className="text-white font-semibold">
                {file ? "Change File" : "Choose Audio File"}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                or drag and drop (WAV, MP3, etc.)
              </p>
            </button>
          </div>

          {/* Selected File Display */}
          {file && (
            <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-slate-600/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div>
                  <p className="text-white font-medium">{fileName}</p>
                  <p className="text-sm text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="px-3 py-1 rounded text-sm text-red-400 hover:bg-red-900/20 transition-colors"
              >
                Remove
              </button>
            </div>
          )}

          <p className="text-sm text-slate-400 mt-2">
            Supported formats: WAV, MP3, and other common audio formats
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300">
            {error}
          </div>
        )}

        {/* Morse Code Output */}
        {morse && (
          <div className="mb-8 p-6 rounded-lg bg-slate-800/50 border border-slate-600/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Detected Morse Code</h3>
              <button
                onClick={() => copyToClipboard(morse)}
                className="text-xs px-3 py-1 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="font-mono text-lg text-cyan-300 break-words p-4 bg-slate-900/50 rounded-lg max-h-32 overflow-y-auto">
              {morse}
            </div>
            <p className="text-sm text-slate-400 mt-3">
              · (dot) - (dash) / (space between letters) | (space between words)
            </p>
          </div>
        )}

        {/* Text Output */}
        {text && (
          <div className="mb-8 p-6 rounded-lg bg-slate-800/50 border border-slate-600/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Decoded Text</h3>
              <button
                onClick={() => copyToClipboard(text)}
                className="text-xs px-3 py-1 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="text-2xl text-green-300 font-semibold p-4 bg-slate-900/50 rounded-lg break-words">
              {text}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDecode}
            disabled={loading || !file}
            className="flex-1 min-w-[150px] px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 disabled:cursor-not-allowed text-white shadow-lg hover:shadow-cyan-600/50"
          >
            {loading ? "Decoding..." : "Decode Audio"}
          </button>
          {(morse || text) && (
            <button
              onClick={handleClear}
              className="flex-1 min-w-[150px] px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-slate-700/50 hover:bg-slate-700 text-slate-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
