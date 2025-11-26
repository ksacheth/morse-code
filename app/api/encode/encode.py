#!/usr/bin/env python3
"""
Morse Code Encoder - Converts text to morse code and generates audio
CLI script that outputs JSON with morse code and audio details
Supports channel simulation: AWGN, Fading, and Frequency Drift
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


# --- Channel Simulation Functions ---

def add_awgn(signal: np.ndarray, snr_db: float) -> np.ndarray:
    """
    Add Additive White Gaussian Noise to the signal.
    
    Args:
        signal: Input signal (float array)
        snr_db: Signal-to-Noise Ratio in dB (higher = less noise)
        
    Returns:
        Noisy signal
    """
    if snr_db >= 100:  # Effectively no noise
        return signal
    
    # Calculate signal power
    signal_power = np.mean(signal ** 2)
    
    # Calculate noise power based on SNR
    snr_linear = 10 ** (snr_db / 10)
    noise_power = signal_power / snr_linear
    
    # Generate noise
    noise = np.sqrt(noise_power) * np.random.randn(len(signal))
    
    return signal + noise


def add_fading(signal: np.ndarray, sample_rate: int, fade_freq: float = 0.5, fade_depth: float = 0.3) -> np.ndarray:
    """
    Apply slow fading to simulate signal strength variations.
    Multiplies the signal by a slowly varying sinusoidal envelope.
    
    Args:
        signal: Input signal (float array)
        sample_rate: Sample rate in Hz
        fade_freq: Frequency of fading in Hz (how fast the signal fades)
        fade_depth: Depth of fading (0-1, where 1 means signal can go to 0)
        
    Returns:
        Faded signal
    """
    if fade_depth <= 0:
        return signal
    
    fade_depth = min(fade_depth, 0.9)  # Cap at 0.9 to avoid complete silence
    
    t = np.arange(len(signal)) / sample_rate
    # Create fading envelope: varies between (1-fade_depth) and 1
    fade_envelope = 1 - fade_depth * (0.5 + 0.5 * np.sin(2 * np.pi * fade_freq * t))
    
    return signal * fade_envelope


def add_frequency_drift(signal: np.ndarray, sample_rate: int, base_freq: float, 
                        drift_amount: float = 10, drift_rate: float = 0.1) -> np.ndarray:
    """
    Simulate frequency drift by regenerating the signal with a time-varying frequency.
    This creates a more realistic effect by modulating the instantaneous frequency.
    
    Args:
        signal: Input signal (used to detect envelope/timing)
        sample_rate: Sample rate in Hz
        base_freq: Original tone frequency in Hz
        drift_amount: Maximum frequency deviation in Hz
        drift_rate: Rate of drift oscillation in Hz
        
    Returns:
        Signal with frequency drift applied
    """
    if drift_amount <= 0:
        return signal
    
    n_samples = len(signal)
    t = np.arange(n_samples) / sample_rate
    
    # Create time-varying frequency
    freq_variation = drift_amount * np.sin(2 * np.pi * drift_rate * t)
    instantaneous_freq = base_freq + freq_variation
    
    # Calculate phase by integrating frequency
    phase = 2 * np.pi * np.cumsum(instantaneous_freq) / sample_rate
    
    # Generate new signal with drifting frequency
    drifted_signal = np.sin(phase)
    
    # Extract envelope from original signal (to preserve timing)
    # Use absolute value and smooth it
    envelope = np.abs(signal)
    # Simple smoothing
    window_size = int(sample_rate * 0.005)  # 5ms window
    if window_size > 1:
        kernel = np.ones(window_size) / window_size
        envelope = np.convolve(envelope, kernel, mode='same')
    
    # Apply envelope to drifted signal
    # Normalize envelope
    max_env = np.max(envelope)
    if max_env > 0:
        envelope = envelope / max_env
    
    return drifted_signal * envelope




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
                        dash_ms: int = DASH_MS,
                        # Channel simulation parameters
                        noise_snr: float = 100,      # SNR in dB (100 = no noise)
                        fading_enabled: bool = False,
                        fade_depth: float = 0.3,
                        fade_freq: float = 0.5,
                        drift_enabled: bool = False,
                        drift_amount: float = 10,
                        drift_rate: float = 0.1):
    """
    Convert text to Morse audio with optional channel simulation and write to WAV file.
    
    Channel Simulation Options:
        noise_snr: Signal-to-Noise Ratio in dB (lower = more noise, 100 = clean)
        fading_enabled: Whether to apply slow fading
        fade_depth: How deep the fading goes (0-1)
        fade_freq: How fast the fading oscillates (Hz)
        drift_enabled: Whether to apply frequency drift
        drift_amount: Maximum frequency deviation (Hz)
        drift_rate: How fast the frequency drifts (Hz)
    
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

    # Convert to float for processing
    audio_float = audio_array.astype(np.float64) / (2**15 - 1)
    
    # Apply channel simulation effects
    channel_effects_applied = []
    
    # 1. Apply frequency drift first (before other effects)
    if drift_enabled and drift_amount > 0:
        audio_float = add_frequency_drift(audio_float, sample_rate, freq, drift_amount, drift_rate)
        channel_effects_applied.append(f"Frequency Drift (±{drift_amount}Hz)")
        log_time(f"Applied frequency drift: ±{drift_amount}Hz at {drift_rate}Hz rate")
    
    # 2. Apply fading
    if fading_enabled and fade_depth > 0:
        audio_float = add_fading(audio_float, sample_rate, fade_freq, fade_depth)
        channel_effects_applied.append(f"Fading (depth={fade_depth}, freq={fade_freq}Hz)")
        log_time(f"Applied fading: depth={fade_depth}, freq={fade_freq}Hz")
    
    # 3. Apply AWGN (noise) last
    if noise_snr < 100:
        audio_float = add_awgn(audio_float, noise_snr)
        channel_effects_applied.append(f"AWGN (SNR={noise_snr}dB)")
        log_time(f"Applied AWGN: SNR={noise_snr}dB")
    
    # Normalize and convert back to int16
    max_val = np.max(np.abs(audio_float))
    if max_val > 0:
        audio_float = audio_float / max_val * 0.9  # Leave some headroom
    
    audio_array = (audio_float * (2**15 - 1)).astype(np.int16)

    # Write WAV (mono, 16-bit)
    with wave.open(output_wav_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 2 bytes -> 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(audio_array.tobytes())

    duration = len(audio_array) / sample_rate
    return output_wav_path, morse_str, duration, channel_effects_applied


def main():
    """Main CLI entry point"""
    log_time("Encoder script started")
    
    parser = argparse.ArgumentParser(
        description="Encode text to morse code and generate audio with optional channel simulation"
    )
    parser.add_argument("text", help="Text to encode")
    parser.add_argument("output", help="Output WAV file path")
    parser.add_argument("--sample-rate", type=int, default=SAMPLE_RATE, help="Sample rate (Hz)")
    parser.add_argument("--dot-duration", type=int, default=DOT_MS, help="Dot duration (ms)")
    parser.add_argument("--frequency", type=int, default=FREQ, help="Tone frequency (Hz)")
    
    # Channel simulation arguments
    parser.add_argument("--noise-snr", type=float, default=100, 
                        help="Signal-to-Noise Ratio in dB (lower = more noise, 100 = clean)")
    parser.add_argument("--fading", action="store_true", help="Enable slow fading effect")
    parser.add_argument("--fade-depth", type=float, default=0.3, 
                        help="Fading depth (0-1, default 0.3)")
    parser.add_argument("--fade-freq", type=float, default=0.5, 
                        help="Fading frequency in Hz (default 0.5)")
    parser.add_argument("--drift", action="store_true", help="Enable frequency drift effect")
    parser.add_argument("--drift-amount", type=float, default=10, 
                        help="Maximum frequency drift in Hz (default 10)")
    parser.add_argument("--drift-rate", type=float, default=0.1, 
                        help="Drift oscillation rate in Hz (default 0.1)")
    
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
        _, morse_result, duration, effects = write_wav_from_text(
            args.text,
            args.output,
            sample_rate=args.sample_rate,
            freq=args.frequency,
            dot_ms=args.dot_duration,
            # Channel simulation
            noise_snr=args.noise_snr,
            fading_enabled=args.fading,
            fade_depth=args.fade_depth,
            fade_freq=args.fade_freq,
            drift_enabled=args.drift,
            drift_amount=args.drift_amount,
            drift_rate=args.drift_rate
        )
        log_time("Audio generated and written to file")
        
        # Output JSON result
        output = {
            "morse": morse_result,
            "text": args.text.upper(),
            "duration": round(duration, 2),
            "sample_rate": args.sample_rate,
            "frequency": args.frequency,
            "channel_effects": effects if effects else ["Clean (no effects)"]
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
