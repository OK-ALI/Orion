import { Component } from "react";
import { classifyOrionError } from "../../services/errors";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, descriptor: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, descriptor: classifyOrionError(error, "renderer") };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, descriptor: null, showDetails: false });
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkLoadError = /dynamically imported module|loading chunk|chunkloaderror/i.test(
        this.state.error?.message || "",
      );
      const descriptor = this.state.descriptor || classifyOrionError(this.state.error, this.props.context || "renderer");
      return (
        <div className="page-placeholder">
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{descriptor.title}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 400, textAlign: "center" }}>
            {descriptor.guidance}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => { if (isChunkLoadError) window.location.reload(); else this.setState({ hasError: false, error: null, descriptor: null, showDetails: false }); }}>{isChunkLoadError ? "Reload Orion" : "Try again"}</button>
            <button className="btn btn-ghost" onClick={() => this.setState((state) => ({ showDetails: !state.showDetails }))}>{this.state.showDetails ? "Hide details" : "Show details"}</button>
          </div>
          {this.state.showDetails && <div className="error-diagnostics"><code>{descriptor.diagnostic}</code><small>Recovery ID: {descriptor.recoveryId}</small><button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(`${descriptor.diagnostic}\nRecovery ID: ${descriptor.recoveryId}`)}>Copy diagnostics</button></div>}
        </div>
      );
    }
    return this.props.children;
  }
}
