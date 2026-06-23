"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Application error</h2>
        <p style={{ fontSize: "0.875rem", color: "#a1a1aa", maxWidth: "28rem" }}>
          {error.message || "A critical error occurred. Please reload the page."}
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            background: "#fafafa",
            color: "#0a0a0a",
            fontWeight: 500,
            cursor: "pointer",
            border: "none",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
