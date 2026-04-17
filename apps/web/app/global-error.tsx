"use client";

/**
 * Global Error Page — catches errors in the root layout itself.
 * This is the absolute last resort error boundary.
 * Must include its own <html> and <body> tags.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
          color: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: 520,
            padding: "2rem",
            position: "relative",
          }}
        >
          {/* Glow orb */}
          <div
            style={{
              position: "absolute",
              top: "-60px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />

          {/* Error icon */}
          <div
            style={{
              width: 80,
              height: 80,
              margin: "0 auto 1.5rem",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.1)",
              border: "2px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
            }}
          >
            ⚠️
          </div>

          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              margin: "0 0 0.75rem",
              background: "linear-gradient(135deg, #f8fafc, #94a3b8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.025em",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: "0.95rem",
              color: "#94a3b8",
              margin: "0 0 2rem",
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. Don&apos;t worry, your data is safe.
            Please try again or contact support if the problem persists.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                fontFamily: "monospace",
                margin: "0 0 1.5rem",
                padding: "0.5rem 1rem",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "0.5rem",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              type="button"
              style={{
                padding: "0.65rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.25)",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(99, 102, 241, 0.35)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(99, 102, 241, 0.25)";
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              type="button"
              style={{
                padding: "0.65rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#94a3b8",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
