import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px",
          background: "#0E0D0A",
          color: "#F5F3EE",
        }}
      >
        <div style={{ fontSize: 32, letterSpacing: 6, textTransform: "uppercase", color: "#FF3B00" }}>SoundMaxx</div>
        <div style={{ marginTop: 24, fontSize: 78, fontWeight: 800, lineHeight: 1.05 }}>Audio Tool Studio</div>
        <div style={{ marginTop: 18, fontSize: 30, opacity: 0.85 }}>
          Stem Isolation · Free Mastering · Key/BPM · Loudness · Audio to MIDI
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
