import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#18181e] text-[#e8e8ec]">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-center text-sm text-[#8a8a96]">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-4 py-2 text-sm font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
