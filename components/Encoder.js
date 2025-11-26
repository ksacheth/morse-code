"use client";

import { useState } from "react";

export default function Encoder() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  // Channel simulation state
  const [showChannelOptions, setShowChannelOptions] = useState(false);
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const [noiseSnr, setNoiseSnr] = useState(20); // dB
  const [fadingEnabled, setFadingEnabled] = useState(false);
  const [fadeDepth, setFadeDepth] = useState(0.3);
  const [fadeFreq, setFadeFreq] = useState(0.5);
  const [driftEnabled, setDriftEnabled] = useState(false);
  const [driftAmount, setDriftAmount] = useState(10);
  const [driftRate, setDriftRate] = useState(0.1);

  const handleEncode = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const response = await fetch("/api/encode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          // Channel simulation options
          noiseSnr: noiseEnabled ? noiseSnr : 100,
          fadingEnabled,
          fadeDepth,
          fadeFreq,
          driftEnabled,
          driftAmount,
          driftRate,
        }),
      });

      if (!response.ok) {
        throw new Error("Encoding failed");
      }

      const data = await response.json();
      setResult(data);

      if (data.audio) {
        const byteCharacters = atob(data.audio);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = "morse.wav";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Morse Code Encoder</h2>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Enter Text
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-black text-black"
          placeholder="Type something to encode..."
        />
      </div>

      {/* Channel Simulation Options */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowChannelOptions(!showChannelOptions)}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition cursor-pointer"
        >
          <span className="font-medium text-gray-700">
            📡 Channel Simulation{" "}
            {(noiseEnabled || fadingEnabled || driftEnabled) && (
              <span className="ml-2 text-xs text-blue-600 font-normal">
                (Active)
              </span>
            )}
          </span>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${
              showChannelOptions ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showChannelOptions && (
          <div className="p-4 space-y-5 border-t border-gray-200 bg-white">
            <p className="text-sm text-gray-500">
              Simulate real-world transmission channel effects to test decoder
              robustness.
            </p>

            {/* AWGN Noise */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noiseEnabled}
                    onChange={(e) => setNoiseEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-700">
                    Add Noise (AWGN)
                  </span>
                </label>
              </div>
              {noiseEnabled && (
                <div className="ml-6 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">SNR: {noiseSnr} dB</span>
                    <span className="text-gray-400 text-xs">
                      {noiseSnr <= 5
                        ? "Very Noisy"
                        : noiseSnr <= 15
                        ? "Noisy"
                        : noiseSnr <= 25
                        ? "Moderate"
                        : "Light"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={noiseSnr}
                    onChange={(e) => setNoiseSnr(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Heavy noise</span>
                    <span>Light noise</span>
                  </div>
                </div>
              )}
            </div>

            {/* Fading */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fadingEnabled}
                    onChange={(e) => setFadingEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-700">Add Fading</span>
                </label>
              </div>
              {fadingEnabled && (
                <div className="ml-6 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Fade Depth: {(fadeDepth * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.1"
                      value={fadeDepth}
                      onChange={(e) => setFadeDepth(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Fade Speed: {fadeFreq} Hz
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.1"
                      value={fadeFreq}
                      onChange={(e) => setFadeFreq(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Frequency Drift */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={driftEnabled}
                    onChange={(e) => setDriftEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-700">
                    Add Frequency Drift
                  </span>
                </label>
              </div>
              {driftEnabled && (
                <div className="ml-6 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Drift Amount: ±{driftAmount} Hz
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={driftAmount}
                      onChange={(e) => setDriftAmount(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Drift Rate: {driftRate} Hz
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.5"
                      step="0.05"
                      value={driftRate}
                      onChange={(e) => setDriftRate(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleEncode}
        disabled={loading || !text}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? "Encoding..." : "Encode to Morse"}
      </button>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Morse Code Output
            </h3>
            <p className="font-mono text-lg text-gray-900 break-all">
              {result.morse}
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(result.morse)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Copy to Clipboard
            </button>
          </div>

          {/* Channel Effects Applied */}
          {result.channel_effects && result.channel_effects.length > 0 && (
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h3 className="text-sm font-medium text-orange-800 mb-2">
                Channel Effects Applied
              </h3>
              <ul className="text-sm text-orange-700 space-y-1">
                {result.channel_effects.map((effect, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                    {effect}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {audioUrl && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="text-sm font-medium text-blue-800 mb-3">
                Audio Playback
              </h3>
              <audio controls className="w-full" src={audioUrl}>
                Your browser does not support the audio element.
              </audio>
              <div className="mt-3 text-center">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  Download Audio
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
