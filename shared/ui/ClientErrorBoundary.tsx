"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ClientErrorBoundary]", error, info);
    // TODO: отправка в Sentry
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            className="flex items-center justify-center h-40 text-sm gap-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Что-то пошло не так.
            <button
              onClick={this.handleReset}
              className="underline hover:opacity-70"
            >
              Попробовать снова
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}