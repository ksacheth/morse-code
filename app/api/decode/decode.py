import numpy as np
from sklearn.cluster import KMeans
import warnings
import sys
import wave # For reading WAV files
import argparse # For command-line arguments
import os
import json
import time

# Track timing for debugging
start_time = time.time()

def log_time(message):
    """Print timing information for debugging"""
    elapsed = time.time() - start_time
    sys.stderr.write(f"[{elapsed:.2f}s] {message}\n")

# --- Step 1: Read Audio File ---
#
def read_wave(file: os.PathLike) -> tuple[int, np.ndarray]:
    """Read WAV file into numpy array (Mono only)"""
    try:
        with wave.open(str(file), "rb") as wav_file:
            n_frames = wav_file.getnframes()
            if n_frames == 0:
                return wav_file.getframerate(), np.array([], dtype=np.int16) # Return empty array for empty file
            buffer = wav_file.readframes(n_frames)
            sample_width_bytes = wav_file.getsampwidth()
            sample_rate = wav_file.getframerate()
            n_channels = wav_file.getnchannels()

            if sample_width_bytes == 1:
                dtype = np.uint8 # 8-bit WAV is unsigned
            elif sample_width_bytes == 2:
                dtype = np.int16 # 16-bit WAV is signed
            else:
                raise ValueError(f"Unsupported sample width: {sample_width_bytes} bytes")

            if n_channels > 1:
                raise NotImplementedError(
                    f"Cannot read WAV file with more than one channel, found: {n_channels}"
                )

            data = np.frombuffer(buffer, dtype=dtype)
            return sample_rate, data
    except wave.Error as e:
        sys.stderr.write(f"Error reading WAV file {file}: {e}\n")
        sys.exit(1)
    except FileNotFoundError:
        sys.stderr.write(f"Error: File not found - {file}\n")
        sys.exit(1)

# --- Step 2a: Calculate Smoothed Power (Envelope) ---
#
def smoothed_power(
    data: np.ndarray, window_size: int, mode: str = "same" # Changed default to 'same'
) -> np.ndarray:
    """Calculate moving time window RMS power for a signal"""
    if data.size == 0:
        return np.array([], dtype=data.dtype)

    # Convert data to avoid truncation/overflow and handle unsigned 8-bit
    if data.dtype == np.uint8:
        # Center 8-bit data around zero before squaring
        secure_data = data.astype(np.int16) - 128
    elif np.issubdtype(data.dtype, np.integer):
        # Use float32 for power calculation to handle large squared values
        secure_data = data.astype(np.float32)
    else:
         # Assume float input is okay, ensure at least float32
        secure_data = data.astype(np.float32) if data.itemsize < 4 else data

    # Create window with integral=1
    window = np.hanning(window_size)
    if sum(window) == 0: return np.zeros_like(secure_data, dtype=data.dtype) # Avoid division by zero
    window = window / sum(window)

    squared = np.power(secure_data, 2)
    convolved_signal = np.convolve(squared, window, mode=mode)

    # Ensure no negative values due to floating point inaccuracies before sqrt
    convolved_signal = np.maximum(convolved_signal, 0)

    smoothed_envelope_float = np.sqrt(convolved_signal)

    # Optionally convert back towards original dtype range if needed,
    # but float is generally safer for thresholding. Let's return float.
    # If returning original type: return smoothed_envelope_float.astype(data.dtype)
    return smoothed_envelope_float # Return float for better thresholding precision

# --- Step 2b: Create Square Wave (Thresholding) ---
#
def squared_signal(data: np.ndarray, threshold: float = None) -> np.ndarray:
    """Convert signal to binary 0/1 based on threshold value"""
    if data.size == 0:
        return np.array([], dtype=np.int8)

    max_val = np.max(data)
    if max_val == 0: # Handle silent input
        return np.zeros_like(data, dtype=np.int8)

    threshold_value = threshold if threshold is not None else 0.5 * max_val
    binary_signal = np.where(data > threshold_value, 1, 0)
    square_wave = binary_signal.astype(np.int8)
    return square_wave

# --- Step 3: Measure Durations ---
#
def calculate_on_off_samples(square_wave: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Calculate signal ON (1s) and OFF (0s) durations in samples."""
    if len(square_wave) == 0:
        return np.array([], dtype=int), np.array([], dtype=int)

    square_diff = np.diff(square_wave)
    rising_idx = np.nonzero(square_diff == 1)[0]
    falling_idx = np.nonzero(square_diff == -1)[0]

    # --- Handle edge cases ---
    starts_on = square_wave[0] == 1
    ends_on = square_wave[-1] == 1

    if starts_on:
        # Add a virtual rising edge at the beginning
        rising_idx = np.insert(rising_idx, 0, -1)
    if ends_on:
        # Add a virtual falling edge at the end
        falling_idx = np.insert(falling_idx, len(falling_idx), len(square_wave) - 1)

    # Ensure pairs match up
    min_len = min(len(rising_idx), len(falling_idx))
    # Crucially, if starts_on, the first falling edge corresponds to the virtual rising edge
    # If not starts_on, the first rising edge corresponds to the first falling edge
    if not starts_on and len(rising_idx) > 0 and len(falling_idx) > 0 and falling_idx[0] < rising_idx[0]:
         # Ignore the first falling edge if it appears before any rising edge (and didn't start ON)
         falling_idx = falling_idx[1:]
         min_len = min(len(rising_idx), len(falling_idx))


    rising_idx = rising_idx[:min_len]
    falling_idx = falling_idx[:min_len]

    if len(rising_idx) == 0 or len(falling_idx) == 0: # No complete ON periods found
         return np.array([], dtype=int), np.array([], dtype=int)

    # Calculate ON durations (using project's apparent logic for consistency)
    on_samples = falling_idx - rising_idx

    # Calculate OFF durations
    if len(rising_idx) > 1:
        off_samples = rising_idx[1:] - falling_idx[:-1]
    else:
        off_samples = np.array([], dtype=int)

    # Filter out non-positive durations
    on_samples = on_samples[on_samples > 0]
    off_samples = off_samples[off_samples > 0]

    return on_samples, off_samples


# --- Step 4a: Cluster ON Durations (Dots vs. Dashes) ---
#
def identify_dots_dashes(on_samples: np.ndarray, sample_rate: int = None) -> np.ndarray:
    """Identifies dots (.) and dashes (-) from ON sample lengths using K-Means (k=2)."""
    if len(on_samples) == 0:
        return np.array([], dtype=str)

    unique_on = np.unique(on_samples)
    n_clusters_on = min(2, len(unique_on))

    # Handle case with only one duration type found
    if n_clusters_on < 2:
        if sample_rate is None:
            raise UserWarning("Cannot distinguish dot/dash: Only one ON duration type found and no sample_rate provided for guessing.")

        sys.stderr.write("WARNING: Only one ON duration type found. Guessing dot/dash based on ~90ms threshold.\n")
        dot_duration_ms = 60 # Approx ms for a dot at ~20 WPM
        threshold_ms = dot_duration_ms * 1.5 # ~90ms separator
        threshold_samples = threshold_ms / 1000.0 * sample_rate

        single_duration = unique_on[0]
        if single_duration < threshold_samples:
            return np.array(['.'] * len(on_samples), dtype=str)
        else:
            return np.array(['-'] * len(on_samples), dtype=str)

    # Proceed with K-Means for 2 clusters
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

# --- Step 4b: Cluster OFF Durations (Spaces) ---
INTRA_CHAR_SPACE = 0
INTER_LETTER_SPACE = 1
INTER_WORD_SPACE = 2
#
def identify_spaces(off_samples: np.ndarray) -> tuple[np.ndarray, np.ndarray, list]:
    """
    Identifies space types from OFF sample lengths using K-Means (k=up to 3).
    Returns space types, cluster centers, and the identified labels for each type.
    """
    if len(off_samples) == 0:
        return np.array([], dtype=int), np.array([], dtype=float), [-1, -1, -1] # No labels

    unique_off = np.unique(off_samples)
    n_clusters_off = min(3, len(unique_off))

    if n_clusters_off == 0: # Should not happen if len(off_samples)>0, but safety check
        return np.array([], dtype=int), np.array([], dtype=float), [-1, -1, -1]

    column_vec_off = off_samples.reshape(-1, 1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        kmeans_off = KMeans(n_clusters=n_clusters_off, random_state=0, n_init=10).fit(column_vec_off)

    cluster_centers_off = kmeans_off.cluster_centers_.flatten()
    sorted_center_indices = np.argsort(cluster_centers_off)

    # Map sorted indices (0=shortest, 1=medium, 2=longest) back to original kmeans labels
    intra_label, letter_label, word_label = -1, -1, -1 # Initialize labels as not found

    if n_clusters_off >= 1:
        intra_label = sorted_center_indices[0]
    if n_clusters_off >= 2:
        letter_label = sorted_center_indices[1]
    if n_clusters_off >= 3:
        word_label = sorted_center_indices[2]

    # Create map from kmeans label to our standard space types (0, 1, 2)
    label_to_space_type = {}
    if intra_label != -1: label_to_space_type[intra_label] = INTRA_CHAR_SPACE
    if letter_label != -1: label_to_space_type[letter_label] = INTER_LETTER_SPACE
    if word_label != -1: label_to_space_type[word_label] = INTER_WORD_SPACE

    space_types = np.array([label_to_space_type.get(label, -1) for label in kmeans_off.labels_], dtype=int)

    return space_types, np.sort(cluster_centers_off), [intra_label, letter_label, word_label]


# --- Step 5a: Group into Words ---
# - logic adapted
def group_morse_words(
    dash_dot_characters: np.ndarray,
    off_samples: np.ndarray, # Use original off samples for splitting
    space_labels: list # Labels assigned by identify_spaces: [intra, letter, word]
    ) -> list[list[str]]:
    """Groups dot/dash sequence into characters and words using space labels."""
    intra_label, letter_label, word_label = space_labels

    if len(dash_dot_characters) == 0:
        return []

    # Find indices where spaces are NOT intra-character (these mark character ends)
    if intra_label == -1: # No intra-character spaces found (e.g., only "E T")
         char_break_indices = np.arange(len(off_samples)) + 1
    else:
        # Need to re-run kmeans just to get labels for original off_samples
        if len(off_samples) == 0:
            char_break_indices = np.array([], dtype=int)
        else:
            column_vec_off = off_samples.reshape(-1, 1)
            n_clusters_off = len(np.unique([intra_label, letter_label, word_label] + [-1])) -1 # Number of valid labels found
            if n_clusters_off <= 0: # Only -1, something went wrong
                 return []
            with warnings.catch_warnings():
                 warnings.simplefilter("ignore")
                 kmeans_off_temp = KMeans(n_clusters=n_clusters_off, random_state=0, n_init=10).fit(column_vec_off)

            char_break_indices = np.nonzero(kmeans_off_temp.labels_ != intra_label)[0] + 1


    # Split the dash/dot array into characters based on these breaks
    morse_chars_list = ["".join(arr) for arr in np.split(dash_dot_characters, char_break_indices)]
    # Filter out potential empty strings from splitting edge cases
    morse_characters = [mc for mc in morse_chars_list if mc]


    # Find indices within the *character list* where word spaces occur
    if word_label == -1: # No word spaces found
        word_break_indices_in_chars = np.array([], dtype=int)
    else:
        # Identify which of the character breaks were actually word breaks
        char_or_word_space_labels = kmeans_off_temp.labels_[kmeans_off_temp.labels_ != intra_label]
        word_break_indices_in_chars = np.nonzero(char_or_word_space_labels == word_label)[0] + 1


    # Split the character list into words
    morse_words_list = [list(arr) for arr in np.split(np.array(morse_characters, dtype=object), word_break_indices_in_chars)]
    # Filter empty words
    morse_words = [mw for mw in morse_words_list if mw]


    return morse_words


# --- Step 5b: Translate to Text ---
#
MORSE_CODE_DICT = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
    '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
    '.-.-.-': '.' # Example punctuation
    # Add more punctuation as needed
}
#
def translate_morse(morse_words: list[list[str]]) -> str:
    """Translates list of morse-coded words to string."""
    translated_words = []
    for word_list in morse_words:
        current_word = "".join([MORSE_CODE_DICT.get(morse_char, '?') for morse_char in word_list])
        translated_words.append(current_word)
    final_message = " ".join(translated_words)
    return final_message

# --- Main Execution ---
# - argparse logic adapted
if __name__ == "__main__":
    log_time("Script started")

    parser = argparse.ArgumentParser(
        description="Decode morse code from a WAV audio file."
    )
    parser.add_argument("wavfile", help="Input audio file (.wav format)")
    args = parser.parse_args()

    log_time("Arguments parsed")

    # --- Step 1 ---
    sample_rate, data = read_wave(args.wavfile)
    log_time("Audio file read")
    # print(f"Read file: {args.wavfile}, Sample Rate: {sample_rate}, Data Length: {len(data)}")
    if len(data) == 0:
        # print("Audio file is empty or could not be read properly.")
        sys.exit(0)

    # --- Step 2a ---
    # Ensure data is suitable type for processing
    if data.dtype == np.uint8:
         data_proc = data.astype(np.int16) - 128
    else:
         data_proc = data.astype(np.float32) # Use float for calculations

    window_size_samples = int(0.01 * sample_rate) # Window size for smoothing
    if window_size_samples < 1: window_size_samples = 1 # Ensure window size is at least 1
    # print(f"Using smoothing window size: {window_size_samples} samples")
    smoothed_envelope = smoothed_power(data_proc, window_size_samples, mode="same")
    log_time("Smoothing envelope calculated")

    # --- Step 2b ---
    square_wave = squared_signal(smoothed_envelope)
    log_time("Square wave generated")
    # print(f"Generated square wave of length: {len(square_wave)}")

    # --- Step 3 ---
    on_durations, off_durations = calculate_on_off_samples(square_wave)
    log_time("ON/OFF durations calculated")
    # print(f"Found {len(on_durations)} ON durations and {len(off_durations)} OFF durations.")
    if len(on_durations) == 0:
        # print("No beeps detected.")
        sys.exit(0)

    # --- Step 4a ---
    try:
        dash_dot_characters = identify_dots_dashes(on_durations, sample_rate)
        log_time("Dots/dashes identified")
        # print(f"Classified {len(dash_dot_characters)} dots/dashes.")
    except UserWarning as e:
        sys.stderr.write(f"Error classifying dots/dashes: {e}\n")
        sys.exit(1)


    # --- Step 4b ---
    if len(off_durations) > 0:
        try:
             # Need kmeans labels to pass to group_morse_words
             space_types, space_centers, space_cluster_labels = identify_spaces(off_durations)
             log_time("Spaces identified")
             # print(f"Classified {len(space_types)} spaces into {len(space_centers)} types.")
             # print(f"Space cluster centers (samples): {space_centers}")
        except UserWarning as e:
            sys.stderr.write(f"Warning during space classification: {e}\n")
            # Attempt to continue, assuming fewer space types
            space_types, space_centers, space_cluster_labels = identify_spaces(off_durations)

    else:
        # print("No spaces found between beeps.")
        space_types = np.array([], dtype=int)
        space_cluster_labels = [-1, -1, -1] # No labels assigned


    # --- Step 5a ---
    # Use the more robust grouping function
    morse_words = group_morse_words(dash_dot_characters, off_durations, space_cluster_labels)
    log_time("Morse words grouped")
    # print(f"Grouped into {len(morse_words)} words.")

    # --- Step 5b & 6 ---
    final_text = translate_morse(morse_words)
    log_time("Text translated from morse")

    # Generate morse code representation
    morse_representation = " / ".join([" ".join(word) for word in morse_words])

    # Output as JSON for the API
    output = {
        "morse": morse_representation,
        "text": final_text
    }
    log_time("Decoding complete - outputting JSON")
    print(json.dumps(output))