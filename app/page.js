"use client";

import { useState } from "react";
import { Decoder } from "@/components/Decoder";
import { Encoder } from "@/components/Encoder";

export default function Home() {
  const [activeTab, setActiveTab] = useState("encoder");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                ·−·· −−·−−· ·−
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Morse Code</h1>
                <p className="text-sm text-slate-400">Encoder & Decoder</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Convert Between Text & Morse Code
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Encode text to morse code with audio output, or decode morse from audio files. Perfect for learning and communication.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-4 mb-12">
          <button
            onClick={() => setActiveTab("encoder")}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === "encoder"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
            }`}
          >
            📝 Encoder
          </button>
          <button
            onClick={() => setActiveTab("decoder")}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === "decoder"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/50"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
            }`}
          >
            🔊 Decoder
          </button>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 gap-8">
          {activeTab === "encoder" ? <Encoder /> : <Decoder />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900/50 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400">
          <p>Made by Team 13</p>
        </div>
      </footer>
    </div>
  );
}
