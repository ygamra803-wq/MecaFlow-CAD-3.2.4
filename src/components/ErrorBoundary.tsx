import React, { ErrorInfo, ReactNode } from 'react';
import { ErrorHandler } from '../lib/errorHandler';
import { Logger } from '../lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ErrorHandler.handle(error, 'ErrorBoundary: ' + errorInfo.componentStack);
    Logger.critical('خطأ في React Component', 'ErrorBoundary', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-900/20" dir="rtl">
          <div className="bg-red-900 p-8 rounded-lg text-white max-w-md shadow-2xl border border-red-700">
            <h1 className="text-2xl font-bold mb-4">❌ حدث خطأ</h1>
            <p className="mb-6">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
