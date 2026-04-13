import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { MANAGER_PANEL_STYLE } from "./theme";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export default class AnalyticsErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown rendering error",
    };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    console.error("[AnalyticsErrorBoundary]", error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="rounded-2xl p-6" style={MANAGER_PANEL_STYLE}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-700">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Upload preview crashed</h3>
            <p className="mt-1 text-sm text-slate-600">
              The report caused a rendering error. Your app is still running. Try uploading again or use another sheet format.
            </p>
            {this.state.errorMessage ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                Error: {this.state.errorMessage}
              </p>
            ) : null}
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw size={14} />
              Retry panel
            </button>
          </div>
        </div>
      </section>
    );
  }
}
