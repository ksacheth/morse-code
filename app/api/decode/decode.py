#!/usr/bin/env python3
import numpy as np
from sklearn.cluster import KMeans
import warnings
import sys
import wave
import argparse
import os
import json
import time
from scipy.signal import butter, filtfilt
from scipy.fft import fft, fftfreq

# Track timing for debugging
start_time = time.time()

def log_time(message):
    """Print timing information for debugging"""
    elapsed = time.time() - start_time
    sys.stderr.write(f"[{elapsed:.2f}s] {message}\n")

# --- Step 1: Read Audio File ---
def read_wave(file: os.PathLike) -> tuple[int, np.ndarray]:
    """Read WAV file into numpy array (Mono only)"""
    try:
        with wave.open(str(file), "rb") as wav_file:
            n_frames = wav_file.getnframes()
            if n_frames == 0:
                return wav_file.getframerate(), np.array([], dtype=np.int16)
            buffer = wav_file.readframes(n_frames)
            sample_width_bytes = wav_file.getsampwidth()
            sample_rate = wav_file.getframerate()
            n_channels = wav_file.getnchannels()

            if sample_width_bytes == 1:
                dtype = np.uint8
            elif sample_width_bytes == 2:
                dtype = np.int16
            else:
                raise ValueError(f"Unsupported sample width: {sample_width_bytes} bytes")

            if n_channels > 1:
                # Take only the first channel if stereo
                sys.stderr.write(f"Warning: Stereo file detected. Using first channel only.\n")
            
            data = np.frombuffer(buffer, dtype=dtype)
            
            # Reshape for stereo/multi-channel and take channel 0
            if n_channels > 1:
                data = data.reshape(-1, n_channels)[:, 0]

            return sample_rate, data
    except wave.Error as e:
        sys.stderr.write(f"Error reading WAV file {file}: {e}\n")
        sys.exit(1)
    except FileNotFoundError:
        sys.stderr.write(f"Error: File not found - {file}\n")
        sys.exit(1)

# --- Signal Processing Helpers ---

def bandpass_filter_signal(data, sample_rate):
    """
    1. Use FFT to find the dominant frequency (the beep).
    2. Apply a Bandpass Filter around that frequency to remove noise.
    Returns: float32 array
    """
    # Work with floats to avoid integer overflow issues
    data_float = data.astype(np.float32)

    # 1. FFT to find dominant frequency
    n = len(data_float)
    # Analyze a chunk if file is too long for quick FFT
    analyze_len = min(n, sample_rate * 2) 
    analyze_data = data_float[:analyze_len]

    # Apply FFT
    yf = fft(analyze_data)
    xf = fftfreq(analyze_len, 1 / sample_rate)
    
    # Get magnitude, ignore DC (0Hz)
    magnitudes = np.abs(yf[:analyze_len//2])
    magnitudes[0] = 0 
    
    # Find peak
    peak_freq_idx = np.argmax(magnitudes)
    peak_freq = xf[peak_freq_idx]
    
    sys.stderr.write(f"Detected dominant frequency: {peak_freq:.2f} Hz\n")

    # 2. Design Bandpass Filter (Butterworth)
    # Filter width: +/- 100 Hz around peak
    lowcut = peak_freq - 100
    highcut = peak_freq + 100
    
    # Safety checks
    if lowcut <= 50: lowcut = 50
    if highcut >= sample_rate / 2: highcut = sample_rate / 2 - 100
    
    order = 4
    nyquist = 0.5 * sample_rate
    low = lowcut / nyquist
    high = highcut / nyquist
    
    if low >= high or high >= 1.0:
        sys.stderr.write("Filter parameters invalid, skipping filter.\n")
        return data_float

    b, a = butter(order, [low, high], btype='band')
    
    # 3. Apply Filter (Zero-phase filtering)
    filtered_data = filtfilt(b, a, data_float)
    
    return filtered_data

def smoothed_power(data: np.ndarray, window_size: int, mode: str = "same") -> np.ndarray:
    """Calculate moving time window RMS power for a signal"""
    if data.size == 0:
        return np.array([], dtype=np.float32)

    # Data is already float32 from main/filter
    secure_data = data

    # Create window with integral=1
    window = np.hanning(window_size)
    if sum(window) == 0: return np.zeros_like(secure_data)
    window = window / sum(window)

    squared = np.power(secure_data, 2)
    convolved_signal = np.convolve(squared, window, mode=mode)

    # Ensure no negative values
    convolved_signal = np.maximum(convolved_signal, 0)
    smoothed_envelope = np.sqrt(convolved_signal)

    return smoothed_envelope

def squared_signal(data: np.ndarray, threshold: float = None) -> tuple[np.ndarray, float]:
    """Convert signal to binary 0/1 based on threshold value"""
    if data.size == 0:
        return np.array([], dtype=np.int8), 0.0

    max_val = np.max(data)
    if max_val == 0:
        return np.zeros_like(data, dtype=np.int8), 0.0

    threshold_value = threshold if threshold is not None else 0.5 * max_val
    binary_signal = np.where(data > threshold_value, 1, 0)
    square_wave = binary_signal.astype(np.int8)
    return square_wave, threshold_value

# --- Decoding Logic ---

def calculate_on_off_samples(square_wave: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if len(square_wave) == 0:
        return np.array([], dtype=int), np.array([], dtype=int)

    square_diff = np.diff(square_wave)
    rising_idx = np.nonzero(square_diff == 1)[0]
    falling_idx = np.nonzero(square_diff == -1)[0]

    starts_on = square_wave[0] == 1
    ends_on = square_wave[-1] == 1

    if starts_on:
        rising_idx = np.insert(rising_idx, 0, -1)
    if ends_on:
        falling_idx = np.insert(falling_idx, len(falling_idx), len(square_wave) - 1)

    min_len = min(len(rising_idx), len(falling_idx))
    if not starts_on and len(rising_idx) > 0 and len(falling_idx) > 0 and falling_idx[0] < rising_idx[0]:
         falling_idx = falling_idx[1:]
         min_len = min(len(rising_idx), len(falling_idx))

    rising_idx = rising_idx[:min_len]
    falling_idx = falling_idx[:min_len]

    if len(rising_idx) == 0:
         return np.array([], dtype=int), np.array([], dtype=int)

    on_samples = falling_idx - rising_idx
    if len(rising_idx) > 1:
        off_samples = rising_idx[1:] - falling_idx[:-1]
    else:
        off_samples = np.array([], dtype=int)

    on_samples = on_samples[on_samples > 0]
    off_samples = off_samples[off_samples > 0]

    return on_samples, off_samples

def identify_dots_dashes(on_samples: np.ndarray, sample_rate: int) -> np.ndarray:
    if len(on_samples) == 0:
        return np.array([], dtype=str)

    unique_on = np.unique(on_samples)
    n_clusters_on = min(2, len(unique_on))

    if n_clusters_on < 2:
        # Fallback heuristic: dot is usually < 120ms (at <20wpm)
        # But rigorous way: assume standard 60-100ms dot
        # Let's use a dynamic threshold based on sample rate
        # 100ms
        threshold_samples = int(0.100 * sample_rate)
        avg_dur = np.mean(on_samples)
        if avg_dur < threshold_samples:
             return np.array(['.'] * len(on_samples), dtype=str)
        else:
             return np.array(['-'] * len(on_samples), dtype=str)

    column_vec_on = on_samples.reshape(-1, 1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        kmeans_on = KMeans(n_clusters=2, random_state=0, n_init=10).fit(column_vec_on)

    cluster_centers_on = kmeans_on.cluster_centers_.flatten()
    dot_cluster_label = np.argmin(cluster_centers_on)
    dash_cluster_label = np.argmax(cluster_centers_on)

    dash_dot_map = {dot_cluster_label: '.', dash_cluster_label: '-'}
    dash_dot_characters = np.array([dash_dot_map[label] for label in kmeans_on.labels_], dtype=str)

    return dash_dot_characters

INTRA_CHAR_SPACE = 0
INTER_LETTER_SPACE = 1
INTER_WORD_SPACE = 2

def identify_spaces(off_samples: np.ndarray) -> tuple[np.ndarray, np.ndarray, list]:
    if len(off_samples) == 0:
        return np.array([], dtype=int), np.array([], dtype=float), [-1, -1, -1]

    unique_off = np.unique(off_samples)
    n_clusters_off = min(3, len(unique_off))

    if n_clusters_off == 0:
        return np.array([], dtype=int), np.array([], dtype=float), [-1, -1, -1]

    column_vec_off = off_samples.reshape(-1, 1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        kmeans_off = KMeans(n_clusters=n_clusters_off, random_state=0, n_init=10).fit(column_vec_off)

    cluster_centers_off = kmeans_off.cluster_centers_.flatten()
    sorted_center_indices = np.argsort(cluster_centers_off)
    sorted_centers = np.sort(cluster_centers_off)

    intra_label, letter_label, word_label = -1, -1, -1

    if n_clusters_off >= 1: intra_label = sorted_center_indices[0]
    if n_clusters_off >= 2: letter_label = sorted_center_indices[1]
    if n_clusters_off >= 3: word_label = sorted_center_indices[2]

    label_to_space_type = {}
    if intra_label != -1: label_to_space_type[intra_label] = INTRA_CHAR_SPACE
    if letter_label != -1: label_to_space_type[letter_label] = INTER_LETTER_SPACE
    if word_label != -1: label_to_space_type[word_label] = INTER_WORD_SPACE

    space_types = np.array([label_to_space_type.get(label, -1) for label in kmeans_off.labels_], dtype=int)
    
    # If we only have 2 clusters, check if the larger one should be split into letter/word
    # Word space is typically 7 units vs letter space 3 units (ratio ~2.3x)
    # Use the intra-character gap as baseline - word space should be ~7x intra, letter ~3x intra
    if n_clusters_off == 2 and len(sorted_centers) >= 2:
        intra_center = sorted_centers[0]  # smallest cluster center = intra-char gap
        # Word space threshold: if gap is > 5x the intra gap, it's likely a word space
        # (midpoint between 3x for letter and 7x for word)
        word_threshold = intra_center * 5.0
        
        sys.stderr.write(f"DEBUG: intra_center={intra_center}, word_threshold={word_threshold}\n")
        
        for i in range(len(space_types)):
            if space_types[i] == INTER_LETTER_SPACE and off_samples[i] > word_threshold:
                space_types[i] = INTER_WORD_SPACE
                sys.stderr.write(f"DEBUG: Promoted off_samples[{i}]={off_samples[i]} to WORD_SPACE\n")

    return space_types, np.sort(cluster_centers_off), [intra_label, letter_label, word_label]

def group_morse_words(dash_dot_characters, off_samples, space_labels) -> list[list[str]]:
    intra_label, letter_label, word_label = space_labels
    if len(dash_dot_characters) == 0: return []

    if intra_label == -1:
         char_break_indices = np.arange(len(off_samples)) + 1
    else:
        if len(off_samples) == 0:
            char_break_indices = np.array([], dtype=int)
        else:
            column_vec_off = off_samples.reshape(-1, 1)
            # Re-fit to get labels consistent if needed, but we can reuse if aligned.
            # To be safe and simple, we assume identify_spaces was just run.
            # But we need the actual labels array which identify_spaces computed internally but didn't return fully raw.
            # We'll re-run quickly or approximate.
            # Better approach: map off_samples to nearest cluster center.
            # For simplicity in this script, let's re-run for indices.
            n_clust = len([x for x in space_labels if x != -1])
            if n_clust == 0: n_clust = 1
            with warnings.catch_warnings():
                 warnings.simplefilter("ignore")
                 km = KMeans(n_clusters=n_clust, random_state=0, n_init=10).fit(column_vec_off)
            
            # We need to match these new labels to our identified space_labels
            # This is getting complex. Let's use a simpler distance metric.
            centers = km.cluster_centers_.flatten()
            labels = km.labels_
            
            # Determine which label is "intra" (smallest center)
            sorted_idx = np.argsort(centers)
            current_intra_label = sorted_idx[0]
            
            char_break_indices = np.nonzero(labels != current_intra_label)[0] + 1
            
            # For words
            if word_label != -1 and len(sorted_idx) >= 3:
                current_word_label = sorted_idx[2]
                # Filter breaks that are word breaks
                word_break_indices_in_chars = np.nonzero(labels[labels != current_intra_label] == current_word_label)[0] + 1
            elif word_label != -1 and len(sorted_idx) == 2:
                 # If we only found 2 clusters but one was mapped to word (unlikely but possible)
                 current_word_label = sorted_idx[1]
                 word_break_indices_in_chars = np.nonzero(labels[labels != current_intra_label] == current_word_label)[0] + 1
            else:
                word_break_indices_in_chars = np.array([], dtype=int)

    morse_chars_list = ["".join(arr) for arr in np.split(dash_dot_characters, char_break_indices)]
    morse_characters = [mc for mc in morse_chars_list if mc]

    morse_words_list = [list(arr) for arr in np.split(np.array(morse_characters, dtype=object), word_break_indices_in_chars)]
    morse_words = [mw for mw in morse_words_list if mw]

    return morse_words

MORSE_CODE_DICT = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
    '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
    '.-.-.-': '.'
}

def translate_morse(morse_words: list[list[str]]) -> str:
    translated_words = []
    for word_list in morse_words:
        current_word = "".join([MORSE_CODE_DICT.get(morse_char, '?') for morse_char in word_list])
        translated_words.append(current_word)
    final_message = " ".join(translated_words)
    return final_message

def downsample_for_viz(arr, target_len=1000):
    """Downsample array to a fixed size for frontend visualization"""
    if len(arr) <= target_len:
        return arr.tolist()
    # Simple decimation
    step = len(arr) // target_len
    # Ensure we don't return too many
    return arr[::step][:target_len].tolist()

def normalize_for_viz(arr):
    """Normalize array to 0-1 range for visualization"""
    if len(arr) == 0:
        return arr
    max_val = np.max(np.abs(arr))
    if max_val == 0:
        return arr
    return arr / max_val

# --- Main Execution ---
if __name__ == "__main__":
    log_time("Script started")

    parser = argparse.ArgumentParser()
    parser.add_argument("wavfile", help="Input audio file")
    args = parser.parse_args()

    # 1. Read
    sample_rate, data = read_wave(args.wavfile)
    if len(data) == 0:
        print(json.dumps({"error": "Empty file"}))
        sys.exit(0)

    # 2. Pre-process (Float conversion & DC removal for 8-bit)
    if data.dtype == np.uint8:
        data_proc = data.astype(np.float32) - 128.0
    else:
        data_proc = data.astype(np.float32)

    # 3. Filter
    try:
        data_filtered = bandpass_filter_signal(data_proc, sample_rate)
        log_time("Applied FFT Bandpass Filter")
    except Exception as e:
        sys.stderr.write(f"Filtering failed: {e}\n")
        data_filtered = data_proc

    # 4. Envelope
    window_size = int(0.01 * sample_rate)
    if window_size < 1: window_size = 1
    envelope = smoothed_power(data_filtered, window_size)
    
    # 5. Threshold
    square_wave, threshold_val = squared_signal(envelope)
    
    # Normalize threshold for visualization (0-1 range relative to envelope max)
    envelope_max = np.max(envelope) if len(envelope) > 0 else 1.0
    threshold_normalized = threshold_val / envelope_max if envelope_max > 0 else 0.5

    # 6. Decode
    on_dur, off_dur = calculate_on_off_samples(square_wave)
    
    if len(on_dur) == 0:
        # Return what we have for viz even if no dots detected
        output = {
            "morse": "",
            "text": "No signal detected",
            "visualization": {
                "audio": downsample_for_viz(data_filtered, 2000),
                "envelope": downsample_for_viz(normalize_for_viz(envelope), 2000),
                "square": downsample_for_viz(square_wave, 2000),
                "threshold": float(threshold_normalized),
                "clustering": {"on": [], "off": []}
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    try:
        dash_dot_chars = identify_dots_dashes(on_dur, sample_rate)
        space_types, _, space_labels = identify_spaces(off_dur) if len(off_dur) > 0 else ([], [], [-1,-1,-1])
        
        # Debug: log space types
        sys.stderr.write(f"DEBUG: off_dur = {off_dur[:20] if len(off_dur) > 20 else off_dur}\n")
        sys.stderr.write(f"DEBUG: space_types = {space_types[:20] if len(space_types) > 20 else space_types}\n")
        sys.stderr.write(f"DEBUG: unique space_types = {np.unique(space_types)}\n")
        
        morse_words = group_morse_words(dash_dot_chars, off_dur, space_labels)
        final_text = translate_morse(morse_words)
        morse_repr = " / ".join([" ".join(w) for w in morse_words])
        
        clustering_data = {
            "on": [{"duration": int(d), "label": l} for d, l in zip(on_dur, dash_dot_chars)],
            "off": [{"duration": int(d), "label": int(l)} for d, l in zip(off_dur, space_types)]
        }
    except Exception as e:
        sys.stderr.write(f"Decoding logic error: {e}\n")
        final_text = "Error decoding"
        morse_repr = ""
        clustering_data = {"on": [], "off": []}

    # 7. Output
    output = {
        "morse": morse_repr,
        "text": final_text,
        "visualization": {
            "audio": downsample_for_viz(data_filtered, 2000),
            "envelope": downsample_for_viz(normalize_for_viz(envelope), 2000),
            "square": downsample_for_viz(square_wave, 2000),
            "threshold": float(threshold_normalized),
            "clustering": clustering_data
        }
    }
    
    print(json.dumps(output))