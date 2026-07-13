import { Component } from "react";
import AppIcon from "./ui/AppIcon";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      resetKey: props.resetKey,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return {
        error: null,
        resetKey: props.resetKey,
      };
    }

    return null;
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error("App page crashed:", error, errorInfo);
    }
  }

  handleNavigate = (callback) => {
    this.setState({ error: null });
    callback?.();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-amber-700 ring-1 ring-amber-200">
              <AppIcon name="warning" size={20} />
            </div>
            <h2 className="mt-3 text-xl font-black text-amber-950">
              Something went wrong while loading this page.
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-amber-800">
              Please reload the app or go back to a safe page. The error was
              captured so the rest of the app can keep running.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-amber-700 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
              onClick={this.handleReload}
              type="button"
            >
              <AppIcon name="refresh" size={16} />
              Reload App
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
              onClick={() => this.handleNavigate(this.props.onGoVehicles)}
              type="button"
            >
              <AppIcon name="car" size={16} />
              Go to Vehicles
            </button>
            {this.props.canViewDashboard && (
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                onClick={() => this.handleNavigate(this.props.onGoDashboard)}
                type="button"
              >
                <AppIcon name="chart-up" size={16} />
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }
}

export default AppErrorBoundary;
