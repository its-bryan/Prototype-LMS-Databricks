import { Component } from "react";

const TOKEN_KEY = "leo_token";

export default class ErrorBoundary extends Component {
  state = { error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
    this.setState({ errorInfo: info });
  }

  handleRetry = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  handleRelogin = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    window.location.assign("/login");
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message ?? String(this.state.error);
      const traceId = this.state.error?.traceId ?? null;
      return (
        <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center font-sans">
          <h1 className="text-2xl font-extrabold text-[var(--hertz-black)] mb-2">We hit an unexpected issue</h1>
          <p className="text-sm text-[var(--neutral-600)] text-center max-w-2xl">{message}</p>
          {traceId && (
            <p className="text-xs text-[var(--neutral-500)] mt-2">
              Reference ID: <span className="font-mono">{traceId}</span>
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              onClick={this.handleRetry}
              className="px-3 py-2 rounded-md bg-[var(--hertz-primary)] text-[var(--hertz-black)] font-semibold text-sm"
            >
              Retry
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-3 py-2 rounded-md border border-[var(--neutral-300)] text-[var(--neutral-700)] font-medium text-sm"
            >
              Go Home
            </button>
            <button
              onClick={this.handleRelogin}
              className="px-3 py-2 rounded-md border border-[var(--neutral-300)] text-[var(--neutral-700)] font-medium text-sm"
            >
              Re-login
            </button>
          </div>
          {this.state.errorInfo?.componentStack && (
            <details className="mt-4 max-w-3xl w-full text-xs text-[var(--neutral-500)]">
              <summary className="cursor-pointer">Technical details</summary>
              <pre className="mt-2 bg-[var(--neutral-50)] p-3 rounded-md overflow-auto">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
