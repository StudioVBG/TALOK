import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Talok — LE Logiciel de Gestion Locative";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 50%, #60A5FA 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            display: "flex",
          }}
        >
          TALOK
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 44,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            lineHeight: 1.15,
            display: "flex",
          }}
        >
          LE Logiciel de Gestion Locative
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 28,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.3,
            display: "flex",
          }}
        >
          Gérez vos locations, encaissez vos loyers et dormez tranquille.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 80,
            right: 80,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "rgba(255,255,255,0.85)",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex" }}>talok.fr</div>
          <div style={{ display: "flex" }}>Né en Martinique</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
