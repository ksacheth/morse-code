# Morse Code Encoder & Decoder - Setup Guide

## Overview

This is a modern, clean website for encoding/decoding Morse Code. The frontend is built with Next.js and Tailwind CSS, and it integrates with your Python scripts for the actual encoding/decoding logic.

## Project Structure

```
claude-code/
├── app/
│   ├── api/
│   │   ├── encode/route.js      # API endpoint for morse encoding
│   │   └── decode/route.js      # API endpoint for morse decoding
│   ├── page.js                  # Main home page
│   ├── layout.js                # Root layout
│   └── globals.css              # Global styles
├── components/
│   ├── Encoder.js               # Encoder UI component
│   └── Decoder.js               # Decoder UI component
├── python_scripts/              # Your Python scripts (create this directory)
│   ├── morse_encoder.py         # Your existing encoder script
│   └── morse_decoder.py         # Your existing decoder script
└── public/                       # Static assets
```

## Setup Instructions

### 1. Create Python Virtual Environment

```bash
# Navigate to the project root directory
cd /Users/sacheth/Documents/Academics/frontend/claude-code

# Create a virtual environment named 'venv'
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install required dependencies
pip install numpy scipy librosa soundfile scikit-learn

# Deactivate when done (optional)
deactivate
```

### 2. Create Python Scripts Directory

```bash
mkdir -p python_scripts
```

### 3. Set Up Your Python Scripts

The API routes expect your Python scripts in the `python_scripts/` directory:

#### `python_scripts/morse_encoder.py`

Your encoder script should:
- Accept text as a command-line argument
- Accept output file path as a second argument
- Generate a WAV file at the output path
- Output JSON to stdout with morse code representation

**Expected behavior:**
```bash
python python_scripts/morse_encoder.py "HELLO WORLD" "/path/to/output.wav"
```

**Expected stdout:**
```json
{
  "morse": ".... . .-.. .-.. --- / .-- --- .-. .-.. -..",
  "text": "HELLO WORLD",
  "duration": 2.5
}
```

#### `python_scripts/morse_decoder.py`

Your decoder script should:
- Accept audio file path as a command-line argument
- Process the audio and extract morse code
- Output JSON to stdout with both morse and decoded text

**Expected behavior:**
```bash
python python_scripts/morse_decoder.py "/path/to/audio.wav"
```

**Expected stdout:**
```json
{
  "morse": ".... . .-.. .-.. --- / .-- --- .-. .-.. -..",
  "text": "HELLO WORLD",
  "confidence": 0.95
}
```

### 4. Install Dependencies

The venv is already set up with the common dependencies. If you need to add more later:

```bash
# Activate venv if not already active
source venv/bin/activate

# Install additional packages as needed
pip install <package-name>

# Or create a requirements.txt for easy management
pip freeze > requirements.txt
```

Common dependencies already installed:
```
numpy
scipy
librosa
soundfile
scikit-learn
```

### 5. Update API Routes (Optional)

If your Python scripts use different:
- **Arguments** - Update the command construction in `app/api/encode/route.js` and `app/api/decode/route.js`
- **Output format** - Update the JSON parsing in the API routes
- **File locations** - Update the `pythonScriptPath` in the API routes

### 6. Test the Setup

```bash
# Make sure venv is set up first
source venv/bin/activate

# Start the development server
npm run dev
```

Visit `http://localhost:3000` and test the encoder/decoder.

**Note:** The venv does NOT need to be activated when running `npm run dev`. The API routes automatically use the venv Python interpreter.

## Integration Details

### Encoder API (`/api/encode`)

**Request:**
```json
{
  "text": "HELLO WORLD"
}
```

**Response:**
```json
{
  "morse": ".... . .-.. .-.. --- / .-- --- .-. .-.. -..",
  "audioUrl": "data:audio/wav;base64,UklGRi4AxQBXQVZFZm10IBAAAA...",
  "status": "success"
}
```

### Decoder API (`/api/decode`)

**Request:** (multipart/form-data)
- File: audio file (WAV, MP3, etc.)

**Response:**
```json
{
  "morse": ".... . .-.. .-.. --- / .-- --- .-. .-.. -..",
  "text": "HELLO WORLD",
  "status": "success"
}
```

## Environment Setup

### Python Script Template

Here's a template for your Python scripts to ensure compatibility:

#### `python_scripts/morse_encoder.py` Template

```python
#!/usr/bin/env python3
import json
import sys
from pathlib import Path

def morse_encode(text, output_path):
    """
    Encode text to morse code and generate audio file

    Args:
        text (str): Text to encode
        output_path (str): Path to save WAV file

    Returns:
        dict: Contains morse code and metadata
    """

    # Your morse encoding logic here
    # ...

    morse_code = ".... . .-.. .-.. --- / .-- --- .-. .-.. -.."

    # Generate audio file and save to output_path
    # ...

    return {
        "morse": morse_code,
        "text": text.upper(),
        "duration": 2.5
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)

    text = sys.argv[1]
    output_path = sys.argv[2]

    result = morse_encode(text, output_path)
    print(json.dumps(result))
```

#### `python_scripts/morse_decoder.py` Template

```python
#!/usr/bin/env python3
import json
import sys
from pathlib import Path

def morse_decode(audio_path):
    """
    Decode morse code from audio file

    Args:
        audio_path (str): Path to audio file

    Returns:
        dict: Contains morse code and decoded text
    """

    # Your morse decoding logic here
    # ...

    morse_code = ".... . .-.. .-.. --- / .-- --- .-. .-.. -.."
    decoded_text = "HELLO WORLD"

    return {
        "morse": morse_code,
        "text": decoded_text,
        "confidence": 0.95
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing audio file path"}))
        sys.exit(1)

    audio_path = sys.argv[1]

    if not Path(audio_path).exists():
        print(json.dumps({"error": "File not found"}))
        sys.exit(1)

    result = morse_decode(audio_path)
    print(json.dumps(result))
```

## Troubleshooting

### Virtual Environment Issues

**"No such file or directory: venv/bin/python"**
- The venv hasn't been created yet
- Run: `python3 -m venv venv`
- Then install dependencies: `pip install numpy scipy librosa soundfile scikit-learn`

**"ModuleNotFoundError: No module named 'sklearn'"**
- Required packages not installed in venv
- Run: `source venv/bin/activate && pip install scikit-learn numpy scipy librosa soundfile`

**"Permission denied" when running Python**
- The venv might have permission issues
- Try: `chmod +x venv/bin/python`
- Or recreate the venv: `rm -rf venv && python3 -m venv venv`

### Python Script Not Found
- Ensure `python_scripts/` directory exists in project root (or `app/api/decode/` for decode.py)
- Verify script filenames match exactly: `morse_encoder.py`, `morse_decoder.py`, `decode.py`

### JSON Parse Error
- Your Python script must output valid JSON to stdout
- Any errors should go to stderr, not stdout
- Remove any debug print statements that go to stdout
- Check terminal logs for actual Python output

### Audio File Issues
- Ensure Python script generates valid WAV files
- The file path must be exact (use absolute paths)
- Check file permissions on temporary directory

### Timeout Issues
- If scripts take too long, increase timeout in API routes (currently 30 seconds)
- Check if decode.py is processing correctly by testing it manually:
  ```bash
  source venv/bin/activate
  python app/api/decode/decode.py /path/to/test.wav
  ```

## Features

✨ **Modern Design**
- Clean, professional interface
- Dark theme with gradient accents
- Fully responsive (mobile, tablet, desktop)

🎯 **Dual Functionality**
- Text → Morse Code with audio download
- Audio → Morse Code + Text
- Real-time feedback and error handling

📱 **User Experience**
- Drag & drop file upload (for decoder)
- Copy to clipboard functionality
- Loading states and error messages
- Audio player for encoded morse

🚀 **Performance**
- Server-side processing with Python
- Efficient file handling
- Optimized UI with Tailwind CSS

## Next Steps

1. Place your Python scripts in `python_scripts/` directory
2. Test scripts manually to ensure they work
3. Adjust API routes if needed for your script interface
4. Run `npm run dev` and test the website
5. Deploy to Vercel or your hosting platform

## Support

If you encounter issues:
1. Check console logs in browser DevTools (F12)
2. Check server logs in terminal
3. Verify Python script outputs valid JSON
4. Ensure all file paths are correct
