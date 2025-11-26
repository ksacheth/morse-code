"use client";

import { useState } from "react";
import Encoder from "../components/Encoder";
import Decoder from "../components/Decoder";
import MorseFlasher from "../components/MorseFlasher";

export default function Home() {
  const [activeTab, setActiveTab] = useState("encoder");

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="text-center py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
          Morse Code <span className="text-blue-600">Master</span>
        </h1>
        <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
          Convert text to Morse code audio, or decode Morse audio back to text
          with advanced signal analysis.
        </p>
      </div>

      <div className="bg-white shadow-xl overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("encoder")}
            className={`flex-1 py-4 px-6 text-center text-sm font-medium transition-colors duration-200 cursor-pointer ${
              activeTab === "encoder"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Encoder
          </button>
          <button
            onClick={() => setActiveTab("decoder")}
            className={`flex-1 py-4 px-6 text-center text-sm font-medium transition-colors duration-200 cursor-pointer ${
              activeTab === "decoder"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Decoder
          </button>
          <button
            onClick={() => setActiveTab("flasher")}
            className={`flex-1 py-4 px-6 text-center text-sm font-medium transition-colors duration-200 cursor-pointer ${
              activeTab === "flasher"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Flasher
          </button>
        </div>

        <div className="p-6 sm:p-10 bg-gray-50/50">
          {activeTab === "encoder" && <Encoder />}
          {activeTab === "decoder" && <Decoder />}
          {activeTab === "flasher" && <MorseFlasher />}
        </div>
      </div>

      <footer className="mt-12 text-center text-sm text-gray-400 pb-8">
        <p>Powered by Next.js & Python</p>
      </footer>
    </main>
  );
}
