/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" untuk delete (merah), "default" untuk konfirmasi biasa */
  variant?: "default" | "destructive";
}

interface SuccessOptions {
  title?: string;
  message?: string;
  /** auto-close otomatis setelah ms; null = tidak auto-close */
  autoCloseMs?: number | null;
}

interface FeedbackContextValue {
  confirm: (opts?: ConfirmOptions) => Promise<boolean>;
  confirmDelete: (opts?: Omit<ConfirmOptions, "variant">) => Promise<boolean>;
  success: (opts?: SuccessOptions) => Promise<void>;
  dismissSuccess: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (v: boolean) => void;
}

interface SuccessState extends SuccessOptions {
  open: boolean;
  resolve?: () => void;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false });
  const [successState, setSuccessState] = useState<SuccessState>({ open: false });
  const successTimer = useRef<number | null>(null);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        title: opts.title ?? "Konfirmasi",
        description: opts.description ?? "Apakah Anda yakin ingin melanjutkan?",
        confirmLabel: opts.confirmLabel ?? "Ya, Lanjutkan",
        cancelLabel: opts.cancelLabel ?? "Batal",
        variant: opts.variant ?? "default",
        resolve,
      });
    });
  }, []);

  const confirmDelete = useCallback(
    (opts: Omit<ConfirmOptions, "variant"> = {}) => {
      return confirm({
        title: opts.title ?? "Hapus data?",
        description:
          opts.description ??
          "Tindakan ini tidak dapat dibatalkan. Data yang dihapus tidak bisa dikembalikan.",
        confirmLabel: opts.confirmLabel ?? "Ya, Hapus",
        cancelLabel: opts.cancelLabel ?? "Batal",
        variant: "destructive",
      });
    },
    [confirm],
  );

  const success = useCallback((opts: SuccessOptions = {}) => {
    return new Promise<void>((resolve) => {
      const autoCloseMs = opts.autoCloseMs === undefined ? 2500 : opts.autoCloseMs;

      setSuccessState({
        open: true,
        title: opts.title ?? "Berhasil",
        message: opts.message ?? "Data berhasil disimpan.",
        autoCloseMs,
        resolve,
      });

      if (successTimer.current) window.clearTimeout(successTimer.current);
      if (autoCloseMs && autoCloseMs > 0) {
        successTimer.current = window.setTimeout(() => {
          setSuccessState((prev) => {
            prev.resolve?.();
            return { ...prev, open: false };
          });
        }, autoCloseMs);
      }
    });
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
    };
  }, []);

  const dismissSuccess = useCallback(() => {
    if (successTimer.current) {
      window.clearTimeout(successTimer.current);
      successTimer.current = null;
    }
    setSuccessState((prev) => {
      prev.resolve?.();
      return { ...prev, open: false };
    });
  }, []);

  const handleConfirmAccept = () => {
    confirmState.resolve?.(true);
    setConfirmState({ open: false });
  };

  const handleConfirmCancel = () => {
    confirmState.resolve?.(false);
    setConfirmState({ open: false });
  };

  const handleSuccessClose = () => {
    if (successTimer.current) {
      window.clearTimeout(successTimer.current);
      successTimer.current = null;
    }
    successState.resolve?.();
    setSuccessState({ open: false });
  };

  const isDestructive = confirmState.variant === "destructive";

  return (
    <FeedbackContext.Provider value={{ confirm, confirmDelete, success, dismissSuccess }}>
      {children}

      {/* Confirm Dialog (untuk delete & aksi destruktif) */}
      <AlertDialog
        open={confirmState.open}
        onOpenChange={(o) => {
          if (!o) handleConfirmCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              {isDestructive && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                  <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
              )}
              <div className="flex-1">
                <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
                <AlertDialogDescription className="mt-1.5">
                  {confirmState.description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmCancel}>
              {confirmState.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAccept}
              className={cn(
                isDestructive && "bg-rose-500 text-white hover:bg-rose-600",
              )}
            >
              {confirmState.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Modal — custom portal (bukan Radix) supaya bebas konflik */}
      {successState.open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal card */}
            <div
              className="relative w-full max-w-sm rounded-2xl border border-border/50 bg-background shadow-2xl p-6 animate-in zoom-in-95 fade-in-0 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center gap-4">
                {/* Check icon stack */}
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50 animate-success-pop">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-10 w-10"
                    >
                      <path d="M5 13l4 4L19 7" className="animate-check-draw" />
                    </svg>
                  </div>
                </div>

                <h2 className="text-xl font-bold animate-title-slide">
                  {successState.title}
                </h2>
                <p className="text-sm text-muted-foreground animate-message-slide">
                  {successState.message}
                </p>

                <Button
                  onClick={handleSuccessClose}
                  className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:brightness-110 min-w-35 mt-2 shadow-md shadow-emerald-500/30"
                >
                  Mantap!
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
