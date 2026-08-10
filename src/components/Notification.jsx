/**
 * client/src/components/Notification.jsx
 * Centered Modern Floating Pill Toast Notification System with Interactive Dismiss
 */

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * @param {Object} props
 * @param {Array<{id, type, title, message}>} props.toasts
 * @param {Function} [props.onDismiss]
 * @param {Function} [props.dismiss]
 */
export function NotificationContainer({ toasts = [], onDismiss, dismiss }) {
  const dismissHandler = onDismiss || dismiss;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissHandler} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const handleDismiss = useCallback(
    (e) => {
      if (e) e.stopPropagation();
      if (typeof onDismiss === 'function') {
        onDismiss(toast.id);
      }
    },
    [toast.id, onDismiss]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [handleDismiss]);

  const typeConfig = {
    success: { icon: '✅', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    error: { icon: '❌', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    info: { icon: '💬', color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
    file: { icon: '📥', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  };

  const currentType = typeConfig[toast.type] || typeConfig.info;

  return (
    <motion.div
      className={`toast-pill toast-${toast.type || 'info'}`}
      initial={{ opacity: 0, y: -24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.92 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      layout
    >
      <div
        className="toast-icon-badge"
        style={{
          background: currentType.bg,
          border: `1px solid ${currentType.border}`,
          color: currentType.color,
        }}
      >
        <span>{currentType.icon}</span>
      </div>

      <div className="toast-body">
        {toast.title && <h4 className="toast-title">{toast.title}</h4>}
        {toast.message && <p className="toast-message">{toast.message}</p>}
      </div>

      <button
        type="button"
        className="toast-close-btn"
        onClick={handleDismiss}
        title="Dismiss Notification"
        aria-label="Dismiss notification"
      >
        ✕
      </button>

      <style>{`
        .toast-pill {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 18px;
          padding: 10px 14px 10px 14px;
          box-shadow: 0 12px 30px -4px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.06);
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 260px;
          max-width: min(420px, calc(100vw - 24px));
          width: 100%;
          box-sizing: border-box;
          pointer-events: all;
          user-select: none;
          z-index: 10000;
        }

        .toast-icon-badge {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.05rem;
          flex-shrink: 0;
        }

        .toast-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .toast-title {
          font-size: 0.86rem;
          font-weight: 800;
          color: #0F172A;
          line-height: 1.25;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .toast-message {
          font-size: 0.78rem;
          color: #64748B;
          line-height: 1.35;
          margin: 0;
          word-break: break-word;
        }

        .toast-close-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid #E2E8F0;
          background: #F8FAFC;
          color: #64748B;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
          padding: 0;
          outline: none;
        }

        .toast-close-btn:hover {
          background: #EF4444;
          color: #FFFFFF;
          border-color: #EF4444;
          transform: scale(1.08);
        }

        .toast-close-btn:active {
          transform: scale(0.92);
        }
      `}</style>
    </motion.div>
  );
}

/**
 * Custom hook to manage toasts
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message }) => {
    setToasts((prev) => {
      // Ignore identical toast if already visible
      if (prev.some((t) => t.title === title && t.message === message)) {
        return prev;
      }
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return [...prev, { id, type, title, message }];
    });
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}
