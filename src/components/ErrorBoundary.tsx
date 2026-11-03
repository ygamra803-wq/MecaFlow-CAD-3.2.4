import React, { ErrorInfo, ReactNode } from 'react';
import { ErrorHandler } from '../lib/errorHandler';
import { Logger } from '../lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, componentStack: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
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
    const stack = errorInfo.componentStack || '';
    this.setState({ componentStack: stack });

    ErrorHandler.handle(error, {
      component: stack,
      location: typeof window !== 'undefined' ? window.location.href : 'unknown'
    });
    Logger.critical('خطأ حرج في مكون React', 'ErrorBoundary', error, stack);

    if (this.props.onError) {
      this.props.onError(error, stack);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, componentStack: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-screen bg-zinc-950 p-4" dir="rtl">
          <div className="bg-zinc-900 p-8 rounded-2xl text-white max-w-lg w-full shadow-2xl border border-red-500/40">
            <h1 className="text-xl font-bold mb-3 text-red-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>حدث خطأ غير متوقع في واجهة النظام</span>
            </h1>
            <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
              {this.state.error?.message || 'تعذر إكمال العملية الحالية.'}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                إعادة المحاولة (استعادة الجلسة)
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                إعادة تحميل التطبيق
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const EnhancedErrorBoundary = ErrorBoundary;
