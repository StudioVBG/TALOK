import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const iconPath = path.join(process.cwd(), "public", "favicon-32.png");
    const iconBuffer = fs.readFileSync(iconPath);

    return new NextResponse(iconBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    const iconPath = path.join(process.cwd(), "public", "images", "talok-icon.png");
    const iconBuffer = fs.readFileSync(iconPath);
    return new NextResponse(iconBuffer, {
      headers: {
        "Content-Type": "image/png",
      },
    });
  }
}

