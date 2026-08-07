/**
 * client/src/components/Notification.jsx
 * Toast notification system — supports success, error, info
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * @param {Object} props
 * @param {Array<{id, type, message}>} props.toasts
 * @param {Function} props.onDismiss
 */
export function NotificationContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = { success: '✅', error: '❌', info: '💬' };

  return (
    <motion.div
      className={`toast toast-${toast.type}`}
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
        {icons[toast.type] || icons.info}
      </span>
      <div style={{ flex: 1 }}>
        {toast.title && (
          <p style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '2px',
          }}>
            {toast.title}
          </p>
        )}
        <p style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-secondary)',
        }}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="btn-icon"
        style={{ padding: '2px 6px', fontSize: '0.7rem' }}
      >
        ✕
      </button>
    </motion.div>
  );
}

/**
 * Custom hook to manage toasts
 */
import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message }) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}
