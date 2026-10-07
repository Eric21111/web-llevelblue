import React from "react";
import { COLORS } from "../constants/colors";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Uncaught rendering error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: 16,
            fontFamily: "Inter, sans-serif",
            color: COLORS.text,
            padding: "40px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: COLORS.sub, fontSize: 14, maxWidth: 400, margin: 0 }}>
            This page encountered an unexpected error. You can try reloading, or
            navigate to a different section.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                background: COLORS.panelAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 12,
                color: "#ff6b6b",
                textAlign: "left",
                maxWidth: 600,
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              background: "#3DD6C4",
              color: "#0F1729",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
