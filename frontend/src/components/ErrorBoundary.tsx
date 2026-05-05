import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Bisa di-pipe ke Sentry dll di production
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-3xl border border-border/50 bg-card p-8 shadow-xl">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/30">
              <AlertTriangle className="h-8 w-8 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight">Terjadi Kesalahan</h1>
              <p className="text-sm text-muted-foreground">
                Aplikasi mengalami error yang tidak terduga. Coba muat ulang halaman.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <pre className="w-full max-h-32 overflow-auto rounded-lg bg-muted px-3 py-2 text-left text-[11px] text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={this.reset}>
                Coba Lagi
              </Button>
              <Button onClick={this.reload}>
                <RefreshCw className="h-4 w-4" />
                Muat Ulang
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
