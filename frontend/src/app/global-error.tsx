"use client";

import { errorCopy } from "@/lib/error-copy";

const copy = errorCopy.internal;

/** Last resort page when the root layout itself fails, so it carries its own document and styles. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070b12",
          color: "#edf1f7",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <title>Something went wrong · SignalXI</title>
        <main style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{copy.title}</h1>
          <p style={{ color: "#97a4b6", lineHeight: 1.6, margin: "0 0 20px" }}>{copy.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 48,
              width: "100%",
              border: 0,
              borderRadius: 12,
              background: "#6e9bff",
              color: "#06101f",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <p style={{ color: "#97a4b6", fontSize: 12, lineHeight: 1.6, margin: "24px 0 0" }}>
            <strong style={{ color: "#edf1f7" }}>18+ only.</strong> Statistical analysis, not
            guaranteed outcomes. Bet responsibly.
          </p>
        </main>
      </body>
    </html>
  );
}
