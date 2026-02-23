import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "My Sister's Taxes — AI Bookkeeping for Small Business";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          backgroundColor: "#18181b",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 24, display: "flex" }}>
          📒
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            marginBottom: 32,
            lineHeight: 1.1,
            display: "flex",
          }}
        >
          My Sister&apos;s Taxes
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#a1a1aa",
            lineHeight: 1.5,
            marginBottom: 40,
            display: "flex",
            maxWidth: 800,
          }}
        >
          Have back taxes overdue? CRA after your ass? This tool is just for
          you. Sign up FREE.
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {[
            "AI tax deduction suggestor",
            "Simple drag and drop upload",
            "Easy P&L, income statement & balance sheet",
            "PDF/CSV printouts for your CPA",
          ].map((f) => (
            <div
              key={f}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 22,
              }}
            >
              <div
                style={{
                  color: "#34d399",
                  fontSize: 24,
                  fontWeight: 700,
                  display: "flex",
                }}
              >
                ✓
              </div>
              <div style={{ color: "#d4d4d8", display: "flex" }}>{f}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 60,
            fontSize: 16,
            color: "#52525b",
            display: "flex",
          }}
        >
          mysisterstaxes.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
