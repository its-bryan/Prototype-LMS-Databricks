import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center font-sans">
          <h1 className="text-xl font-bold text-[var(--hertz-black)] mb-4">Something went wrong</h1>
          <pre className="text-sm text-[var(--color-error)] bg-[var(--color-error-light)] p-4 rounded-lg max-w-2xl overflow-auto">
            {this.state.error?.message ?? String(this.state.error)}
          </pre>
          <p className="mt-4 text-sm text-[var(--neutral-600)]">Check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
