import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled render error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg px-4 mt-16">
          <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-err/10 rounded-full flex items-center justify-center mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-err">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Something went wrong</h2>
            <p className="text-textsecondary mb-8 leading-relaxed">
              An unexpected error occurred while loading this page. Try reloading.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
