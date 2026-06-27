/**
 * @file src/components/ErrorBoundary.tsx
 * @description React class-based error boundary for the ResQ application.
 *
 * Catches JavaScript errors anywhere in the component tree below it,
 * logs the error details, and renders a fallback UI instead of crashing
 * the entire application.
 *
 * Usage: Wrap top-level components to prevent unhandled React errors from
 * breaking the monitoring interface during an active emergency.
 *
 * @see {@link https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary}
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** The component subtree to render when no error has occurred. */
  children: ReactNode;
  /** Optional custom fallback UI. Defaults to the built-in error card. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  /** Whether an error has been caught by this boundary. */
  hasError: boolean;
  /** The caught error object, if any. */
  error: Error | null;
  /** The React component stack trace string. */
  componentStack: string | null;
}

/**
 * Class-based React Error Boundary component.
 *
 * Catches rendering errors in child components and renders a recovery UI.
 * Particularly important for ResQ because a component crash during
 * active monitoring should not prevent the user from cancelling an alert.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  /**
   * Static lifecycle method called when a child throws an error.
   * Returns state updates to trigger the fallback render.
   *
   * @param error - The caught Error object
   * @returns Updated state to enter error mode
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * Called after an error is caught. Logs error details for debugging.
   *
   * @param error - The caught Error object
   * @param info - React error info containing the component stack trace
   */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    // Use raw console here because logger module may itself be erroring
    // eslint-disable-next-line no-console
    console.error('[ResQ ErrorBoundary] Caught rendering error:', error, info.componentStack);
  }

  /**
   * Resets the error state and attempts to re-render the normal UI.
   */
  private handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          id="error-boundary-fallback"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#0a0a0f',
            color: '#f1f5f9',
            padding: '2rem',
            fontFamily: 'Outfit, sans-serif',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '2.5rem',
              maxWidth: '520px',
              width: '100%',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚨</div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#ef4444',
                marginBottom: '0.5rem',
              }}
            >
              Application Error
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              ResQ encountered an unexpected rendering error. Your emergency contacts and monitoring
              settings are preserved. Please reset the interface to continue monitoring.
            </p>
            {this.state.error && (
              <pre
                style={{
                  background: '#0f172a',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.75rem',
                  color: '#fbbf24',
                  textAlign: 'left',
                  overflowX: 'auto',
                  marginBottom: '1.5rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              id="error-boundary-reset-btn"
              onClick={this.handleReset}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Reset Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
