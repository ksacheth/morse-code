#!/usr/bin/env python3
"""
Morse Code Encoder - Converts text to morse code and generates audio
"""

import json
import sys
import argparse
import numpy as np
import soundfile as sf
import time

# Track timing for debugging
start_time = time.time()

def log_time(message):
    """Print timing information for debugging"""
    elapsed = time.time() - start_time
    sys.stderr.write(f"[{elapsed:.2f}s] {message}\n")

# Morse code dictionary
MORSE_CODE_DICT = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
    "'": '.----.','"': '.-..-.', '!': '-.-.--', '/': '-..-.', '(': '-.-.-.',
    ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
    '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '..-..-', '$': '...-..-',
    '@': '.--.-.', ' ': '/'
}

def text_to_morse(text):
    """Convert text to morse code"""
    text = text.upper()
    morse_code = []

    for char in text:
        if char in MORSE_CODE_DICT:
            morse_code.append(MORSE_CODE_DICT[char])
        elif char == ' ':
            # Add word separator (longer pause already handled above)
            if morse_code and morse_code[-1] != '/':
                morse_code.append('/')
        else:
            # Unknown character, skip it
            continue

    return ' '.join(morse_code)

def generate_morse_audio(morse_code, sample_rate=22050, dot_duration=0.1, frequency=800):
    """
    Generate audio for morse code

    Args:
        morse_code: Morse code string (dots and dashes)
        sample_rate: Sample rate in Hz
        dot_duration: Duration of a dot in seconds
        frequency: Frequency of the tone in Hz

    Returns:
        numpy array of audio samples
    """
    dash_duration = dot_duration * 3
    intra_char_gap = dot_duration  # Gap between dots/dashes within a character
    inter_char_gap = dot_duration * 3  # Gap between characters
    word_gap = dot_duration * 7  # Gap between words

    audio = []

    # Generate sine wave for the tone
    t_dot = np.linspace(0, dot_duration, int(sample_rate * dot_duration), False)
    t_dash = np.linspace(0, dash_duration, int(sample_rate * dash_duration), False)

    dot_wave = np.sin(2 * np.pi * frequency * t_dot)
    dash_wave = np.sin(2 * np.pi * frequency * t_dash)

    # Silence samples
    silence_intra = np.zeros(int(sample_rate * intra_char_gap))
    silence_inter = np.zeros(int(sample_rate * inter_char_gap))
    silence_word = np.zeros(int(sample_rate * word_gap))

    # Process morse code string
    elements = morse_code.split(' ')

    for i, element in enumerate(elements):
        if element == '/':  # Word separator
            audio.append(silence_word)
        elif element == '':  # Skip empty elements
            continue
        else:  # Character (sequence of dots and dashes)
            for j, symbol in enumerate(element):
                if symbol == '.':
                    audio.append(dot_wave)
                elif symbol == '-':
                    audio.append(dash_wave)

                # Add gap after each dot/dash (except last one in character)
                if j < len(element) - 1:
                    audio.append(silence_intra)

            # Add gap after character (except last character)
            if i < len(elements) - 1 and elements[i + 1] != '/':
                audio.append(silence_inter)

    # Concatenate all audio segments
    audio_array = np.concatenate(audio) if audio else np.array([])

    # Normalize to prevent clipping
    if len(audio_array) > 0:
        max_val = np.max(np.abs(audio_array))
        if max_val > 0:
            audio_array = audio_array / max_val * 0.9

    return audio_array

def main():
    log_time("Encoder script started")

    parser = argparse.ArgumentParser(
        description="Encode text to morse code and generate audio"
    )
    parser.add_argument("text", help="Text to encode")
    parser.add_argument("output", help="Output WAV file path")
    parser.add_argument("--sample-rate", type=int, default=22050, help="Sample rate (Hz)")
    parser.add_argument("--dot-duration", type=float, default=0.1, help="Dot duration (seconds)")
    parser.add_argument("--frequency", type=int, default=800, help="Tone frequency (Hz)")

    args = parser.parse_args()

    log_time("Arguments parsed")

    # Convert text to morse code
    morse_code = text_to_morse(args.text)
    log_time("Text converted to morse code")

    if not morse_code:
        # No valid characters
        output = {
            "morse": "",
            "text": args.text.upper(),
            "error": "No valid characters in input"
        }
        print(json.dumps(output))
        sys.exit(0)

    # Generate audio
    audio = generate_morse_audio(
        morse_code,
        sample_rate=args.sample_rate,
        dot_duration=args.dot_duration,
        frequency=args.frequency
    )
    log_time("Audio generated")

    # Write to file
    sf.write(args.output, audio, args.sample_rate)
    log_time("Audio written to file")

    # Calculate duration
    duration = len(audio) / args.sample_rate

    # Output JSON result
    output = {
        "morse": morse_code,
        "text": args.text.upper(),
        "duration": round(duration, 2),
        "sample_rate": args.sample_rate,
        "frequency": args.frequency
    }

    log_time("Encoding complete - outputting JSON")
    print(json.dumps(output))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        sys.exit(1)
