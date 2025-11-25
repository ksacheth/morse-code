import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function POST(request) {
  let tempDir = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    // Create a temporary directory for processing
    tempDir = path.join(os.tmpdir(), `morse-decode-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Save the uploaded file
    const inputFilePath = path.join(tempDir, file.name);
    const audioBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputFilePath, audioBuffer);

    console.log("Input file saved to:", inputFilePath);
    console.log("File size:", audioBuffer.length, "bytes");

    // Path to the Python decoder script in the app/api/decode directory
    const pythonScriptPath = path.join(
      process.cwd(),
      "app/api/decode",
      "decode.py"
    );

    console.log("Python script path:", pythonScriptPath);

    // Check if script exists
    try {
      await fs.access(pythonScriptPath);
      console.log("Python script found");
    } catch {
      throw new Error(`Python script not found at: ${pythonScriptPath}`);
    }

    // Execute Python script with virtual environment activation
    const output = await executePythonScript(pythonScriptPath, [inputFilePath]);

    console.log("Python output:", output);

    // Parse the JSON output from the Python script
    let result;
    try {
      result = JSON.parse(output.trim());
    } catch (parseError) {
      console.error("Failed to parse JSON output:", output);
      throw new Error(`Invalid JSON from Python script: ${parseError.message}`);
    }

    // Clean up temporary files
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    return NextResponse.json({
      morse: result.morse || "",
      text: result.text || "",
      visualization: result.visualization || null,
      status: "success",
    });
  } catch (error) {
    console.error("Decoding error:", error);
    console.error("Error stack:", error.stack);

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
        error: "Failed to decode audio",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to execute Python script with virtual environment
function executePythonScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    // Use venv Python directly
    const venvPath = path.join(process.cwd(), "venv");
    const pythonExe = path.join(venvPath, "bin", "python");

    console.log("Using Python from venv:", pythonExe);
    console.log("Script:", scriptPath);
    console.log("Args:", args);

    // Simple command: just run Python from venv directly
    const child = spawn(pythonExe, [scriptPath, ...args], {
      timeout: 120000, // 120 second timeout (2 minutes)
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
      console.log("Final stdout:", stdout);
      console.log("Final stderr:", stderr);

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
      reject(new Error("Python script execution timeout (120s / 2 minutes)"));
    }, 120000);

    child.on("close", () => {
      clearTimeout(timeoutId);
    });
  });
}
