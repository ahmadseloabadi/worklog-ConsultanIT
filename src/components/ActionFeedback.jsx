
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

export function ActionToast({ message, onClose }) {
  const type = message?.type || "info";
  const isProgress = type === "progress";
  const [dismissed, setDismissed] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setDismissed(false);
    if (!message || isProgress) return undefined;
    const timeout = window.setTimeout(() => {
      setDismissed(true);
      onCloseRef.current?.();
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [isProgress, message?.text, type]);

  if (!message || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    onCloseRef.current?.();
  }

  return (
    <div
      className={`action-toast is-${type}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-busy={isProgress}
    >
      <span className="action-toast-icon" aria-hidden="true">
        {isProgress ? <Icon name="loader" size={20} className="action-toast-spinner" /> : <Icon name={type === "success" ? "check" : type === "error" ? "alert" : "info"} size={17} />}
      </span>
      <span className="action-toast-copy">
        <strong>{isProgress ? "Sedang diproses" : type === "success" ? "Berhasil" : type === "error" ? "Gagal" : "Informasi"}</strong>
        <span>{message.text}</span>
      </span>
      {isProgress && (
        <span className="action-toast-progress" role="progressbar" aria-label="Proses sedang berlangsung">
          <span />
        </span>
      )}
      {!isProgress && (
        <button type="button" className="action-toast-close" onClick={dismiss} aria-label="Tutup notifikasi">
          <Icon name="close" size={17} />
        </button>
      )}
    </div>
  );
}

export function ConfirmationDialog({
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const isOpen = Boolean(title && message);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    function handleKeyDown(event) {
      if (event.key === "Escape") onCancel();
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="action-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section
        className="action-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
        aria-describedby="action-dialog-message"
      >
        <span className={`action-dialog-symbol${danger ? " is-danger" : ""}`} aria-hidden="true">
          <Icon name={danger ? "alert" : "info"} size={21} />
        </span>
        <div className="action-dialog-copy">
          <h2 id="action-dialog-title">{title}</h2>
          <p id="action-dialog-message">{message}</p>
        </div>
        <div className="action-dialog-actions">
          <button type="button" className="action-dialog-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={`action-dialog-confirm${danger ? " is-danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function useConfirmation() {
  const [confirmation, setConfirmation] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setConfirmation(options);
  }), []);

  const resolveConfirmation = useCallback((accepted) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setConfirmation(null);
  }, []);

  return {
    confirm,
    confirmation,
    acceptConfirmation: () => resolveConfirmation(true),
    cancelConfirmation: () => resolveConfirmation(false),
  };
}
