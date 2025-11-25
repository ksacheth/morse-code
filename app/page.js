"use client";

import { useState } from "react";
import { Decoder } from "@/components/Decoder";
import { Encoder } from "@/components/Encoder";

export default function Home() {
  const [activeTab, setActiveTab] = useState("encoder");

  return (
    <div className="min-h-screen bg-[#F4F3F3] text-slate-900" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent)', backgroundSize: '30px 30px'}}>
      {/* Header */}
      <header className="border-b border-slate-200 bg-white backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left Side - Branding */}
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-blue-600">
                ·−·· −−·−−· ·−
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Morse Code</h1>
                <p className="text-sm text-slate-600">Encoder & Decoder</p>
              </div>
            </div>

            {/* Right Side - Version Badge */}
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
              v1.0
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Convert Between Text & Morse Code
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Encode text to morse code with audio output, or decode morse from audio files. Perfect for learning and communication.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-4 mb-12">
          <button
            onClick={() => setActiveTab("encoder")}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === "encoder"
                ? "bg-blue-500 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            📝 Encoder
          </button>
          <button
            onClick={() => setActiveTab("decoder")}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === "decoder"
                ? "bg-cyan-500 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
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
      <footer className="border-t border-slate-200 bg-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-600">
          <p>Made by Team 13</p>
        </div>
      </footer>
    </div>
  );
}
