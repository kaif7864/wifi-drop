/**
 * client/src/components/TextShare.jsx
 * Multi-Mode Text Share Component — Supports both Full List View (with live notes) & Single Card View
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  const dateStr = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });

  return `${dateStr}, ${timeStr}`;
}

function SingleTextCard({ textRecord, onDelete }) {
  const [copied, setCopied] = useState(false);
  if (!textRecord) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textRecord.text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <motion.div
      className="text-card glass-card"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      layout
    >
      <div className="text-content">
        <p className="text-body">{textRecord.text || ''}</p>
        <div className="text-meta">
          <span className="device-tag">{textRecord.deviceName || 'Mobile'}</span>
          {textRecord.customerName && (
            <>
              <span className="meta-dot">·</span>
              <span className="customer-tag" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                👤 {textRecord.customerName}
              </span>
            </>
          )}
          <span className="meta-dot">·</span>
          <span>🕒 {formatDateTime(textRecord.receivedAt || textRecord.createdAt)}</span>
        </div>
      </div>
      <div className="text-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleCopy}
        >
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
        {onDelete && (
          <button
            className="btn-icon btn-danger-icon"
            title="Delete"
            onClick={() => onDelete(textRecord.uuid || textRecord.id || textRecord._id)}
            style={{ color: 'var(--danger)' }}
          >
            🗑️
          </button>
        )}
      </div>

      <style>{`
        .text-card {
          padding: var(--space-4) var(--space-5);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }
        .text-content {
          flex: 1;
          min-width: 0;
        }
        .text-body {
          font-size: var(--font-size-sm);
          color: var(--text-primary);
          line-height: 1.6;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .text-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          margin-top: var(--space-2);
          flex-wrap: wrap;
        }
        .device-tag { color: var(--accent-primary); font-weight: 600; }
        .meta-dot { opacity: 0.4; }
        .text-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .text-card {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-3);
            padding: 1rem;
          }

          .text-actions {
            justify-content: flex-end;
            padding-top: var(--space-2);
            border-top: 1px solid var(--border);
          }
        }
      `}</style>
    </motion.div>
  );
}

export function TextShare({ textRecord, texts, onDelete }) {
  // Mode 1: List View (when texts array is provided)
  if (Array.isArray(texts)) {
    if (texts.length === 0) {
      return (
        <div className="empty-state">
          <span className="empty-state-icon">💬</span>
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>No text notes received</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Send text notes, phone numbers, or links from the mobile transfer page
          </p>
        </div>
      );
    }

    return (
      <div className="text-list flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {texts.map((t) => (
            <SingleTextCard
              key={t.uuid || t.id || t._id}
              textRecord={t}
              onDelete={onDelete}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // Mode 2: Single Card View (when textRecord is provided)
  return <SingleTextCard textRecord={textRecord} onDelete={onDelete} />;
}
