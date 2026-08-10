/**
 * client/src/context/ToastContext.jsx
 * Global Glassmorphic Toast Notification System with framer-motion
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastContext = createContext(null);

let globalToastEmitter = null;

/**
 * Global helper to trigger a toast from anywhere without hook boilerplate
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'|'copy'} type 
 * @param {number} duration 
 */
export const toast = {
  success: (msg, duration = 3000) => globalToastEmitter?.(msg, 'success', duration),
  error: (msg, duration = 3500) => globalToastEmitter?.(msg, 'error', duration),
  warning: (msg, duration = 3000) => globalToastEmitter?.(msg, 'warning', duration),
  info: (msg, duration = 3000) => globalToastEmitter?.(msg, 'info', duration),
  copy: (msg = 'Copied to clipboard!', duration = 2500) => globalToastEmitter?.(msg, 'copy', duration),
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast = { id, message, type };

    setToasts((prev) => [...prev.slice(-3), newToast]); // keep max 4 toasts at once

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  globalToastEmitter = addToast;

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getIconAndStyle = (type) => {
    switch (type) {
      case 'success':
        return {
          icon: '✅',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          color: '#065F46',
          dot: '#059669',
        };
      case 'error':
        return {
          icon: '❌',
          bg: '#FEF2F2',
          border: '#FECACA',
          color: '#991B1B',
          dot: '#DC2626',
        };
      case 'warning':
        return {
          icon: '⚠️',
          bg: '#FFFBEB',
          border: '#FDE68A',
          color: '#92400E',
          dot: '#D97706',
        };
      case 'copy':
        return {
          icon: '📋',
          bg: '#EEF2FF',
          border: '#C7D2FE',
          color: '#3730A3',
          dot: '#4F46E5',
        };
      default:
        return {
          icon: 'ℹ️',
          bg: '#F8FAFC',
          border: '#E2E8F0',
          color: '#0F172A',
          dot: '#64748B',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      <div className="wifidrop-toast-container">
        <AnimatePresence>
          {toasts.map((t) => {
            const style = getIconAndStyle(t.type);
            return (
              <motion.div
                key={t.id}
                className="wifidrop-toast-item"
                style={{
                  background: style.bg,
                  border: `1.5px solid ${style.border}`,
                  color: style.color,
                }}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.92 }}
                transition={{ duration: 0.2 }}
                onClick={() => removeToast(t.id)}
              >
                <span className="toast-icon">{style.icon}</span>
                <span className="toast-message">{t.message}</span>
                <button
                  type="button"
                  className="toast-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeToast(t.id);
                  }}
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <style>{`
        .wifidrop-toast-container {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999999;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          pointer-events: none;
          max-width: 90vw;
          width: max-content;
        }

        .wifidrop-toast-item {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 0.84rem;
          font-weight: 700;
          box-shadow: 0 10px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 10px rgba(0, 0, 0, 0.06);
          backdrop-filter: blur(12px);
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .wifidrop-toast-item:hover {
          transform: scale(1.02);
        }

        .toast-icon {
          font-size: 1rem;
          flex-shrink: 0;
        }

        .toast-message {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
        }

        .toast-close-btn {
          background: transparent;
          border: none;
          color: currentColor;
          opacity: 0.5;
          cursor: pointer;
          font-size: 0.72rem;
          padding: 2px 4px;
          border-radius: 50%;
          transition: opacity 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toast-close-btn:hover {
          opacity: 1;
        }

        @media (max-width: 640px) {
          .wifidrop-toast-container {
            top: 16px;
            width: calc(100vw - 32px);
          }
          .toast-message {
            max-width: 220px;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return context ? context.toast : toast;
}
