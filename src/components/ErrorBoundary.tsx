import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

const GENERIC_ERROR =
  "Something went wrong. Please try again or contact us at ";

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center bg-background text-foreground"
      >
        <h1 className="text-2xl md:text-3xl font-semibold mb-4">
          Something went wrong
        </h1>
        <p className="max-w-md text-base text-foreground/80">
          {GENERIC_ERROR}
          <a href="mailto:support@cobbli.com" className="underline">
            support@cobbli.com
          </a>
          .
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-6 h-11 px-6 rounded-md font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </main>
    );
  }
}

export default ErrorBoundary;
