import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Set max duration for text encoding
export const maxDuration = 60; // 1 minute timeout

// Configure body size limit for large payloads
export const bodyParser = {
  sizeLimit: "50mb",
};

export async function POST(request) {
  let tempDir = null;

  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Create a temporary directory for the output
    tempDir = path.join(os.tmpdir(), `morse-encode-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Path to the Python encoder script (in the same directory as this route)
    const pythonScriptPath = path.join(
      process.cwd(),
      "app",
      "api",
      "encode",
      "encode.py"
    );

    console.log("Python script path:", pythonScriptPath);

    // Check if script exists
    try {
      await fs.access(pythonScriptPath);
      console.log("Python script found");
    } catch {
      throw new Error(`Python script not found at: ${pythonScriptPath}`);
    }

    const outputPath = path.join(tempDir, "output.wav");

    // Execute the Python script with venv
    const venvPath = path.join(process.cwd(), "venv");
    const pythonExe = path.join(venvPath, "bin", "python");

    const output = await executePythonScript(pythonExe, [
      pythonScriptPath,
      text,
      outputPath,
    ]);

    console.log("Python output:", output);

    // Parse JSON output from Python script
    let result;
    try {
      result = JSON.parse(output.trim());
    } catch (parseError) {
      console.error("Failed to parse JSON output:", output);
      throw new Error(`Invalid JSON from Python script: ${parseError.message}`);
    }

    // Read the generated audio file
    const audioBuffer = await fs.readFile(outputPath);

    // Convert to base64 for the response
    const base64Audio = audioBuffer.toString("base64");
    const audioUrl = `data:audio/wav;base64,${base64Audio}`;

    // Clean up temporary files
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    return NextResponse.json({
      morse: result.morse || "",
      audioUrl,
      duration: result.duration || 0,
      status: "success",
    });
  } catch (error) {
    console.error("Encoding error:", error);

    // Clean up on error
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        error: "Failed to encode text",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to execute Python script with venv
function executePythonScript(pythonExe, args) {
  return new Promise((resolve, reject) => {
    console.log("Using Python:", pythonExe);
    console.log("Args:", args);

    const child = spawn(pythonExe, args, {
      timeout: 60000, // 60 second timeout
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log("Python stdout:", chunk);
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log("Python stderr:", chunk);
    });

    child.on("close", (code) => {
      if (timedOut) return;

      console.log("Process exit code:", code);

      if (code === 0) {
        if (!stdout.trim()) {
          reject(new Error("Python script produced no output"));
        } else {
          resolve(stdout);
        }
      } else {
        reject(
          new Error(
            `Python script failed with exit code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`
          )
        );
      }
    });

    child.on("error", (err) => {
      console.error("Spawn error:", err);
      reject(err);
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      reject(new Error("Python script execution timeout (60s)"));
    }, 60000);

    child.on("close", () => {
      clearTimeout(timeoutId);
    });
  });
}
