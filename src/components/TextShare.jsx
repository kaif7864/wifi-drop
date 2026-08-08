/**
 * client/src/components/TextShare.jsx
 * Displays received text messages with copy-to-clipboard and delete
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TextShare({ textRecord, onDelete }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textRecord.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <motion.div
      className="text-card glass-card"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      layout
    >
      <div className="text-content">
        <p className="text-body">{textRecord.text}</p>
        <div className="text-meta">
          <span className="device-tag">{textRecord.deviceName}</span>
          {textRecord.customerName && (
            <>
              <span className="meta-dot">·</span>
              <span className="customer-tag" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                👤 {textRecord.customerName}
              </span>
            </>
          )}
          <span className="meta-dot">·</span>
          <span>{formatTime(textRecord.receivedAt)}</span>
        </div>
      </div>
      <div className="text-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleCopy}
        >
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
        <button
          className="btn-icon"
          title="Delete"
          onClick={() => onDelete(textRecord.uuid || textRecord.id || textRecord._id)}
          style={{ color: 'var(--danger)' }}
        >
          🗑️
        </button>
      </div>

      <style>{`
        .text-card {
          padding: var(--space-4) var(--space-5);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
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
          gap: var(--space-1);
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          margin-top: var(--space-2);
        }
        .device-tag { color: var(--accent-secondary); }
        .meta-dot { opacity: 0.4; }
        .text-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
      `}</style>
    </motion.div>
  );
}
