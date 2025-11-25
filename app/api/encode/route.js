import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), "app/api/encode/encode.py");
    const tempDir = os.tmpdir();
    const outputFilePath = path.join(tempDir, `morse-${Date.now()}.wav`);

    // Use Python from virtual environment if available, fallback to python3
    const pythonPath =
      process.env.PYTHON_PATH ||
      path.join(process.cwd(), "venv/bin/python3") ||
      "python3";
    const pythonProcess = spawn(pythonPath, [scriptPath, text, outputFilePath]);

    let dataString = "";
    let errorString = "";

    const exitCode = await new Promise((resolve) => {
      pythonProcess.stdout.on("data", (data) => {
        dataString += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        errorString += data.toString();
      });

      pythonProcess.on("close", (code) => {
        resolve(code);
      });
    });

    if (exitCode !== 0) {
      console.error(`Python script exited with code ${exitCode}`);
      console.error(`Stderr: ${errorString}`);
      // Try to clean up if file was created
      await fs.unlink(outputFilePath).catch(() => {});
      return NextResponse.json(
        { error: "Internal Server Error", details: errorString },
        { status: 500 }
      );
    }

    try {
      const result = JSON.parse(dataString);

      // Read the generated WAV file
      try {
        const audioBuffer = await fs.readFile(outputFilePath);
        const audioBase64 = audioBuffer.toString("base64");
        result.audio = audioBase64;

        // Clean up
        await fs.unlink(outputFilePath);
      } catch (fileError) {
        console.error("Failed to read audio file:", fileError);
        // Don't fail the whole request if just audio read fails, but it's critical here
        return NextResponse.json(
          { error: "Failed to read generated audio" },
          { status: 500 }
        );
      }

      return NextResponse.json(result);
    } catch (e) {
      console.error("Failed to parse Python output:", dataString);
      return NextResponse.json(
        { error: "Invalid response from encoder" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
