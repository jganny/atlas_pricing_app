"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "@/components/ui";
import { reloadOnceIfStale, reportError } from "@/lib/monitoring/error-report";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  reference: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", reference: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message, reference: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A page left open across a release asks for files that no longer exist — one reload fixes it.
    if (reloadOnceIfStale(error.message)) return;
    const reference = reportError({
      message: error.message,
      stack: error.stack,
      source: "boundary",
      componentStack: info.componentStack ?? undefined,
    });
    if (reference) this.setState({ reference });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="m-6 border-red-200 bg-red-50">
          <h2 className="font-bold text-red-900">Something went wrong</h2>
          <p className="mt-2 text-sm text-red-800">
            The app hit an unexpected error. Your data in Firestore is safe. Try refreshing, or use the
            legacy app while we fix this screen.
          </p>
          <p className="mt-2 text-xs text-red-700">{this.state.message}</p>
          {this.state.reference ? (
            <p className="mt-1 text-xs text-red-700">
              Error reference: <span className="font-mono font-bold">{this.state.reference}</span> — it has been reported to the
              admins; quote this code if you contact them.
            </p>
          ) : null}
          <button
            type="button"
            className="mt-4 rounded-lg bg-[var(--color-atlas-navy)] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => this.setState({ hasError: false, message: "", reference: "" })}
          >
            Try again
          </button>
          <a href="/index.html" className="ml-3 text-sm font-semibold text-red-900 underline">
            Open legacy app
          </a>
        </Card>
      );
    }
    return this.props.children;
  }
}
