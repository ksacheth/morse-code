#!/usr/bin/env python3
"""
Morse Code Encoder - Converts text to morse code and generates audio
CLI script that outputs JSON with morse code and audio details
"""

import os
import sys
import json
import argparse
import wave
import numpy as np
import time

# Track timing for debugging
start_time = time.time()

def log_time(message):
    """Print timing information for debugging"""
    elapsed = time.time() - start_time
    sys.stderr.write(f"[{elapsed:.2f}s] {message}\n")

# --- Defaults / Constants ---
SAMPLE_RATE = 44100
FREQ = 800
DOT_MS = 100   # dot duration in ms
DASH_MS = 300  # dash duration in ms

# Morse table
morse_code = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.',
    'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
    'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---',
    'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
    'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    ' ': '/', ',': '--..--', '.': '.-.-.-', '?': '..--..',
}
rev_morse = {v: k for k, v in morse_code.items()}




def text_to_morse(text: str) -> str:
    """
    Convert text to morse code string representation.
    
    Args:
        text: Input text to convert
        
    Returns:
        Morse code string with space-separated characters and '/' for word breaks
    """
    text = text.upper()
    morse_words = []
    
    for ch in text:
        if ch == ' ':
            morse_words.append('/')
            continue
        if ch in morse_code:
            morse_words.append(morse_code[ch])
    
    return ' '.join(morse_words)


def _sine_wave(freq_hz: float, duration_ms: float, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    """
    Create a sinewave (mono) as int16 array for a given freq and duration_ms.
    """
    num_samples = int(sample_rate * (duration_ms / 1000.0))
    if num_samples <= 0:
        return np.array([], dtype=np.int16)
    t = np.linspace(0, duration_ms / 1000.0, num_samples, endpoint=False)
    wavef = 0.5 * np.sin(2 * np.pi * freq_hz * t)
    return (wavef * (2**15 - 1)).astype(np.int16)


def text_to_morse_audio_array(text: str,
                              sample_rate: int = SAMPLE_RATE,
                              freq: int = FREQ,
                              dot_ms: int = DOT_MS,
                              dash_ms: int = DASH_MS):
    """
    Convert a text string to a concatenated numpy int16 audio array representing Morse beeps,
    and return a textual Morse representation.

    Returns:
        (audio_array: np.ndarray(dtype=int16), morse_str: str)
    """
    # Generate samples for dot/dash and gaps (durations in seconds for gaps)
    dot = _sine_wave(freq, float(dot_ms), sample_rate=sample_rate)
    dash = _sine_wave(freq, float(dash_ms), sample_rate=sample_rate)

    # gaps: intra-element (between dot/dash within same char), between characters, between words
    intra = np.zeros(int(sample_rate * 0.1), dtype=np.int16)      # 0.1s
    inter_char = np.zeros(int(sample_rate * 0.3), dtype=np.int16) # 0.3s
    inter_word = np.zeros(int(sample_rate * 0.7), dtype=np.int16) # 0.7s

    pieces = []
    morse_words = []

    for ch in text:
        if ch == ' ':
            morse_words.append('/')
            pieces.append(inter_word)
            continue
        up = ch.upper()
        if up not in morse_code:
            # skip unsupported characters silently
            continue
        seq = morse_code[up]
        morse_words.append(seq)
        for i, s in enumerate(seq):
            if s == '.':
                pieces.append(dot)
            elif s == '-':
                pieces.append(dash)
            # add intra-element gap between symbols of the same character
            if i != len(seq) - 1:
                pieces.append(intra)
        # after each character, add inter-character gap
        pieces.append(inter_char)

    if not pieces:
        return np.array([], dtype=np.int16), ''

    audio = np.concatenate(pieces)
    morse_str = ' '.join(morse_words)
    return audio, morse_str


def write_wav_from_text(text: str,
                        output_wav_path: str,
                        sample_rate: int = SAMPLE_RATE,
                        freq: int = FREQ,
                        dot_ms: int = DOT_MS,
                        dash_ms: int = DASH_MS):
    """
    Convert text to Morse audio and write to WAV file.
    Returns: (output_wav_path, morse_string, duration_seconds)
    """
    # Ensure output directory exists
    out_dir = os.path.dirname(os.path.abspath(output_wav_path))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    audio_array, morse_str = text_to_morse_audio_array(text,
                                                      sample_rate=sample_rate,
                                                      freq=freq,
                                                      dot_ms=dot_ms,
                                                      dash_ms=dash_ms)

    if audio_array.size == 0:
        raise ValueError("No audio generated from input (file may contain unsupported characters or be empty).")

    # Write WAV (mono, 16-bit)
    with wave.open(output_wav_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 2 bytes -> 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(audio_array.tobytes())

    duration = len(audio_array) / sample_rate
    return output_wav_path, morse_str, duration


def main():
    """Main CLI entry point"""
    log_time("Encoder script started")
    
    parser = argparse.ArgumentParser(
        description="Encode text to morse code and generate audio"
    )
    parser.add_argument("text", help="Text to encode")
    parser.add_argument("output", help="Output WAV file path")
    parser.add_argument("--sample-rate", type=int, default=SAMPLE_RATE, help="Sample rate (Hz)")
    parser.add_argument("--dot-duration", type=int, default=DOT_MS, help="Dot duration (ms)")
    parser.add_argument("--frequency", type=int, default=FREQ, help="Tone frequency (Hz)")
    
    args = parser.parse_args()
    
    log_time("Arguments parsed")
    
    # Convert text to morse code
    morse_str = text_to_morse(args.text)
    log_time("Text converted to morse code")
    
    if not morse_str:
        # No valid characters
        output = {
            "morse": "",
            "text": args.text.upper(),
            "duration": 0,
            "error": "No valid characters in input"
        }
        print(json.dumps(output))
        sys.exit(0)
    
    # Generate audio and write to file
    try:
        _, morse_result, duration = write_wav_from_text(
            args.text,
            args.output,
            sample_rate=args.sample_rate,
            freq=args.frequency,
            dot_ms=args.dot_duration
        )
        log_time("Audio generated and written to file")
        
        # Output JSON result
        output = {
            "morse": morse_result,
            "text": args.text.upper(),
            "duration": round(duration, 2),
            "sample_rate": args.sample_rate,
            "frequency": args.frequency
        }
        
        log_time("Encoding complete - outputting JSON")
        print(json.dumps(output))
        
    except Exception as e:
        log_time(f"Error during encoding: {str(e)}")
        output = {
            "error": str(e),
            "text": args.text.upper()
        }
        print(json.dumps(output))
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        sys.exit(1)
