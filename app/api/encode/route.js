import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Create a temporary directory for the output
    const tempDir = path.join(os.tmpdir(), `morse-encode-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Path to your Python encoder script
    // Update this path to match your actual Python file location
    const pythonScriptPath = path.join(
      process.cwd(),
      "python_scripts",
      "morse_encoder.py"
    );

    const outputPath = path.join(tempDir, "output.wav");

    // Execute the Python script
    const command = `python "${pythonScriptPath}" "${text.replace(/"/g, '\\"')}" "${outputPath}"`;

    await execAsync(command);

    // Read the generated audio file
    const audioBuffer = await fs.readFile(outputPath);

    // Convert to base64 for the response
    const base64Audio = audioBuffer.toString("base64");
    const audioUrl = `data:audio/wav;base64,${base64Audio}`;

    // Get the morse code representation
    // This assumes your Python script also returns the morse code somehow
    // You might need to adjust this based on your Python script's output
    const morseOutput = ""; // You'll need to capture this from your Python script

    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      morse: morseOutput,
      audioUrl,
      status: "success",
    });
  } catch (error) {
    console.error("Encoding error:", error);
    return NextResponse.json(
      { error: "Failed to encode text", details: error.message },
      { status: 500 }
    );
  }
}
