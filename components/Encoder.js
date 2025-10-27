"use client";

import { useState } from "react";

export function Encoder() {
  const [text, setText] = useState("");
  const [morse, setMorse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  const handleEncode = async () => {
    if (!text.trim()) {
      setError("Please enter some text to encode");
      return;
    }

    setLoading(true);
    setError("");
    setMorse("");
    setAudioUrl(null);

    try {
      const response = await fetch("/api/encode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Failed to encode text");
      }

      const data = await response.json();
      setMorse(data.morse);
      setAudioUrl(data.audioUrl);
    } catch (err) {
      setError(err.message || "An error occurred while encoding");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = "morse-code.wav";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleClear = () => {
    setText("");
    setMorse("");
    setAudioUrl(null);
    setError("");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white border border-blue-200 rounded-2xl p-8">
        {/* Input Section */}
        <div className="mb-8">
          <label className="block text-lg font-semibold text-slate-900 mb-3">
            Enter Text to Encode
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type the text you want to convert to morse code..."
            className="w-full h-32 px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <p className="text-sm text-slate-600 mt-2">
            Supports letters, numbers, and basic punctuation
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-300 text-red-700">
            {error}
          </div>
        )}

        {/* Morse Code Output */}
        {morse && (
          <div className="mb-8 p-6 rounded-lg bg-slate-50 border border-slate-300">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Morse Code</h3>
            <div className="font-mono text-lg text-blue-600 break-words p-4 bg-white rounded-lg max-h-32 overflow-y-auto border border-slate-200">
              {morse}
            </div>
            <p className="text-sm text-slate-600 mt-3">
              · (dot) - (dash) / (space between letters) | (space between words)
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={handleEncode}
            disabled={loading}
            className="flex-1 min-w-[150px] px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white"
          >
            {loading ? "Encoding..." : "Encode to Morse"}
          </button>
          {morse && (
            <button
              onClick={handleDownload}
              className="flex-1 min-w-[150px] px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-green-500 hover:bg-green-600 text-white"
            >
              ⬇️ Download Audio
            </button>
          )}
          {text && (
            <button
              onClick={handleClear}
              className="flex-1 min-w-[150px] px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-slate-200 hover:bg-slate-300 text-slate-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div className="p-6 rounded-lg bg-slate-50 border border-slate-300">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Play Audio</h3>
            <audio
              controls
              className="w-full"
              src={audioUrl}
            />
            <p className="text-sm text-slate-600 mt-3">
              Listen to the morse code audio representation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
