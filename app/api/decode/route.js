import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Create a temporary file
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(
      tempDir,
      `upload-${Date.now()}-${file.name}`
    );

    await fs.writeFile(tempFilePath, buffer);

    const scriptPath = path.join(process.cwd(), "app/api/decode/decode.py");

    // Use Python from environment variable or default to python3
    const pythonPath = process.env.PYTHON_PATH || "python3";
    const pythonProcess = spawn(pythonPath, [scriptPath, tempFilePath]);

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

    // Clean up temp file
    await fs.unlink(tempFilePath).catch(console.error);

    if (exitCode !== 0) {
      console.error(`Python script exited with code ${exitCode}`);
      console.error(`Stderr: ${errorString}`);
      return NextResponse.json(
        { error: "Internal Server Error", details: errorString },
        { status: 500 }
      );
    }

    try {
      const result = JSON.parse(dataString);
      return NextResponse.json(result);
    } catch (e) {
      console.error("Failed to parse Python output:", dataString);
      return NextResponse.json(
        { error: "Invalid response from decoder" },
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
