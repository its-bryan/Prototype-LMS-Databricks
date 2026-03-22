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
          <h1 className="text-xl font-bold text-[#272425] mb-4">Something went wrong</h1>
          <pre className="text-sm text-red-600 bg-red-50 p-4 rounded-lg max-w-2xl overflow-auto">
            {this.state.error?.message ?? String(this.state.error)}
          </pre>
          <p className="mt-4 text-sm text-[#666]">Check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
