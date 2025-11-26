"use client";

import { useState, useRef, useCallback } from "react";

// Morse code mapping
const MORSE_CODE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
};

export default function MorseFlasher() {
  const [inputText, setInputText] = useState("");
  const [morseCode, setMorseCode] = useState("");
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashState, setFlashState] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [currentChar, setCurrentChar] = useState("");
  const [speed, setSpeed] = useState(100); // Base unit in ms (dot duration)
  const abortRef = useRef(false);

  // Convert text to Morse code
  const textToMorse = (text) => {
    return text
      .toUpperCase()
      .split("")
      .map((char) => {
        if (char === " ") return "/";
        return MORSE_CODE[char] || "";
      })
      .filter((code) => code !== "")
      .join(" ");
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);
    setMorseCode(textToMorse(text));
  };

  // Sleep helper
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Flash the Morse code
  const flashMorse = useCallback(async () => {
    if (!morseCode || isFlashing) return;

    setIsFlashing(true);
    abortRef.current = false;

    const dotDuration = speed;
    const dashDuration = speed * 3;
    const intraCharGap = speed;
    const letterGap = speed * 3;
    const wordGap = speed * 7;

    const chars = inputText.toUpperCase().split("");
    let charIndex = 0;

    for (const symbol of morseCode.split("")) {
      if (abortRef.current) break;

      if (symbol === "/") {
        // Word space
        setCurrentSymbol("⎵");
        setCurrentChar(" ");
        setFlashState(false);
        await sleep(wordGap);
        charIndex++;
      } else if (symbol === " ") {
        // Letter space
        setFlashState(false);
        await sleep(letterGap);
        charIndex++;
      } else if (symbol === ".") {
        // Dot
        setCurrentSymbol("•");
        setCurrentChar(chars[charIndex] || "");
        setFlashState(true);
        await sleep(dotDuration);
        setFlashState(false);
        await sleep(intraCharGap);
      } else if (symbol === "-") {
        // Dash
        setCurrentSymbol("—");
        setCurrentChar(chars[charIndex] || "");
        setFlashState(true);
        await sleep(dashDuration);
        setFlashState(false);
        await sleep(intraCharGap);
      }
    }

    setIsFlashing(false);
    setFlashState(false);
    setCurrentSymbol("");
    setCurrentChar("");
  }, [morseCode, inputText, speed, isFlashing]);

  const stopFlashing = () => {
    abortRef.current = true;
    setIsFlashing(false);
    setFlashState(false);
    setCurrentSymbol("");
    setCurrentChar("");
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 space-y-8">
      <div className="p-6 bg-white rounded-xl shadow-md space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Morse Flasher</h2>
        <p className="text-gray-600">
          Enter text below and watch it flash as Morse code signals.
        </p>

        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="flash-input"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Enter Text
            </label>
            <input
              id="flash-input"
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Type your message here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-lg text-black placeholder-black/60 outline-none"
              disabled={isFlashing}
            />
          </div>

          {/* Morse Code Preview */}
          {morseCode && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <p className="text-sm font-medium text-gray-500 mb-1">
                Morse Code:
              </p>
              <p className="font-mono text-lg text-gray-800 break-all">
                {morseCode}
              </p>
            </div>
          )}

          {/* Speed Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Speed: {speed}ms per dot ({Math.round(1200 / speed)} WPM)
            </label>
            <input
              type="range"
              min="50"
              max="300"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isFlashing}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Fast (24 WPM)</span>
              <span>Slow (4 WPM)</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-4">
            <button
              onClick={flashMorse}
              disabled={!morseCode || isFlashing}
              className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isFlashing ? "Flashing..." : "Start Flash"}
            </button>
            {isFlashing && (
              <button
                onClick={stopFlashing}
                className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow transition cursor-pointer"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Flash Display */}
      <div
        className={`relative w-full aspect-video rounded-2xl shadow-2xl transition-all duration-75 overflow-hidden ${
          flashState
            ? "bg-yellow-400 shadow-yellow-400/50"
            : "bg-gray-900 shadow-gray-900/50"
        }`}
      >
        {/* Grid overlay for visual effect */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isFlashing ? (
            <>
              {/* Current symbol */}
              <div
                className={`text-8xl font-bold transition-colors ${
                  flashState ? "text-gray-900" : "text-yellow-400"
                }`}
              >
                {currentSymbol || (flashState ? "●" : "○")}
              </div>

              {/* Current character */}
              <div
                className={`mt-4 text-4xl font-mono transition-colors ${
                  flashState ? "text-gray-900/70" : "text-gray-400"
                }`}
              >
                {currentChar}
              </div>

              {/* Status */}
              <div
                className={`mt-6 text-sm font-medium uppercase tracking-wider ${
                  flashState ? "text-gray-900/50" : "text-gray-500"
                }`}
              >
                {flashState ? "SIGNAL ON" : "SIGNAL OFF"}
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl text-gray-600">📡</div>
              <p className="mt-4 text-gray-400 text-lg">
                {morseCode
                  ? 'Press "Start Flash" to begin'
                  : "Enter text above to start"}
              </p>
            </>
          )}
        </div>

        {/* Corner indicators */}
        <div className="absolute top-4 left-4">
          <div
            className={`w-3 h-3 rounded-full ${
              flashState ? "bg-gray-900" : "bg-green-500 animate-pulse"
            }`}
          />
        </div>
        <div className="absolute top-4 right-4">
          <span
            className={`text-xs font-mono ${
              flashState ? "text-gray-900" : "text-gray-500"
            }`}
          >
            {isFlashing ? "TX" : "IDLE"}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-8 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-2xl">•</span>
          <span>Dot (1 unit)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">—</span>
          <span>Dash (3 units)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-yellow-400 rounded"></span>
          <span>Signal ON</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-gray-900 rounded border border-gray-600"></span>
          <span>Signal OFF</span>
        </div>
      </div>
    </div>
  );
}
