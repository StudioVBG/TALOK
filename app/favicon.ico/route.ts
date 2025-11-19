import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // Lire le fichier icon.svg
    const iconPath = path.join(process.cwd(), "app", "icon.svg");
    const iconSvg = fs.readFileSync(iconPath, "utf-8");

    // Retourner le SVG avec le bon Content-Type
    // Note: Certains navigateurs acceptent SVG comme favicon
    return new NextResponse(iconSvg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    // Si erreur, retourner un SVG minimal
    const minimalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#3B82F6"/></svg>`;
    return new NextResponse(minimalSvg, {
      headers: {
        "Content-Type": "image/svg+xml",
      },
    });
  }
}

