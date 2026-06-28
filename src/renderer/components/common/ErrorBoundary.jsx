import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const isChunkLoadError = /dynamically imported module|loading chunk|chunkloaderror/i.test(
        this.state.error?.message || "",
      );
      return (
        <div className="page-placeholder">
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 400, textAlign: "center" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (isChunkLoadError) window.location.reload();
              else this.setState({ hasError: false, error: null });
            }}
            style={{ marginTop: 8 }}
          >
            {isChunkLoadError ? "Reload Orion" : "Try Again"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
