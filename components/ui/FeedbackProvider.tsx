"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type FeedbackSeverity = "error" | "warning" | "success" | "info";

type FeedbackInput = {
  title?: string;
  message: string;
};

type ActiveFeedback = {
  id: number;
  severity: FeedbackSeverity;
  title: string;
  message: string;
};

type FeedbackApi = {
  error: (input: string | FeedbackInput) => void;
  warning: (input: string | FeedbackInput) => void;
  success: (input: string | FeedbackInput) => void;
  info: (input: string | FeedbackInput) => void;
  dismiss: () => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

const DEFAULT_TITLES: Record<FeedbackSeverity, string> = {
  error: "Action could not be completed",
  warning: "Attention required",
  success: "Completed",
  info: "Information",
};

function normaliseInput(
  severity: FeedbackSeverity,
  input: string | FeedbackInput
): Omit<ActiveFeedback, "id" | "severity"> {
  if (typeof input === "string") {
    return {
      title: DEFAULT_TITLES[severity],
      message: input,
    };
  }

  return {
    title: input.title?.trim() || DEFAULT_TITLES[severity],
    message: input.message,
  };
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<ActiveFeedback | null>(null);
  const nextId = useRef(0);

  const show = useCallback(
    (severity: FeedbackSeverity, input: string | FeedbackInput) => {
      const normalised = normaliseInput(severity, input);

      nextId.current += 1;

      setFeedback({
        id: nextId.current,
        severity,
        ...normalised,
      });
    },
    []
  );

  const dismiss = useCallback(() => {
    setFeedback(null);
  }, []);

  const error = useCallback(
    (input: string | FeedbackInput) => show("error", input),
    [show]
  );

  const warning = useCallback(
    (input: string | FeedbackInput) => show("warning", input),
    [show]
  );

  const success = useCallback(
    (input: string | FeedbackInput) => show("success", input),
    [show]
  );

  const info = useCallback(
    (input: string | FeedbackInput) => show("info", input),
    [show]
  );

  useEffect(() => {
    if (
      feedback?.severity !== "success" &&
      feedback?.severity !== "info"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFeedback((current) =>
        current?.id === feedback.id ? null : current
      );
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (
      feedback?.severity !== "error" &&
      feedback?.severity !== "warning"
    ) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [feedback, dismiss]);

  const api: FeedbackApi = {
    error,
    warning,
    success,
    info,
    dismiss,
  };

  const blocking =
    feedback?.severity === "error" ||
    feedback?.severity === "warning";

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {feedback && blocking && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`feedback-title-${feedback.id}`}
            aria-describedby={`feedback-message-${feedback.id}`}
            className="w-full max-w-md rounded-3xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-7 shadow-2xl"
          >
            <div className="mb-5 flex items-start gap-4">
              <div
                className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  feedback.severity === "error"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
                aria-hidden="true"
              >
                {feedback.severity === "error" ? "!" : "!"}
              </div>

              <div className="min-w-0">
                <h2
                  id={`feedback-title-${feedback.id}`}
                  className="text-lg font-semibold text-[var(--text-primary)]"
                >
                  {feedback.title}
                </h2>

                <p
                  id={`feedback-message-${feedback.id}`}
                  className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]"
                >
                  {feedback.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              autoFocus
              onClick={dismiss}
              className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {feedback && !blocking && (
        <div
          className="pointer-events-none fixed bottom-6 right-6 z-[300] w-[min(420px,calc(100vw-3rem))]"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-5 py-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {feedback.title}
                </p>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  {feedback.message}
                </p>
              </div>

              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss notification"
                className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error(
      "useFeedback must be used within FeedbackProvider."
    );
  }

  return context;
}
