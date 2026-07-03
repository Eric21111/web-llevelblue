import React from "react";

/**
 * ErrorBoundary
 * Catches JavaScript rendering errors anywhere in the child component tree,
 * logs them, and displays a graceful fallback UI instead of crashing the app.
 */
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
            color: "#E7EBF3",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: "#8C9BBF", fontSize: 14, maxWidth: 400, margin: 0 }}>
            This page encountered an unexpected error. You can try reloading, or
            navigate to a different section.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                background: "#172238",
                border: "1px solid #26334F",
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
