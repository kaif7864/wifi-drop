/**
 * client/src/components/ConfirmDeleteFolderModal.jsx
 * Alert Modal: Permanent Delete Confirmation for Customer Folders (Never Restore Warning)
 */

import { motion } from 'framer-motion';

export function ConfirmDeleteFolderModal({ group, onConfirm, onCancel, isDeleting }) {
  if (!group) return null;

  const folderName = group.customerName || group.name || group.deviceName || group.customerId || 'Customer Folder';
  const fileCount = group.files?.length || 0;
  const textCount = group.texts?.length || 0;

  return (
    <div className="confirm-delete-overlay" onClick={onCancel}>
      <motion.div
        className="confirm-delete-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2 }}
      >
        {/* Warning Icon Badge */}
        <div className="confirm-delete-header">
          <div className="confirm-delete-icon-wrap">
            <span className="confirm-delete-icon">⚠️</span>
          </div>
          <h3 className="confirm-delete-title">Permanently Delete Folder?</h3>
        </div>

        <div className="confirm-delete-folder-box">
          <p className="confirm-folder-name">📁 {folderName}</p>
          <p className="confirm-folder-stats">
            Contains: <b>{fileCount} Files</b> · <b>{textCount} Notes</b>
          </p>
        </div>

        {/* Never Restore Alert Box */}
        <div className="confirm-delete-warning-banner">
          <p className="confirm-warning-text">
            🚨 <b>This action CANNOT BE RESTORED or undone!</b>
          </p>
          <p className="confirm-warning-subtext">
            All files, print status records, and customer documents in this folder will be permanently purged from the server and cannot be recovered.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="confirm-delete-actions">
          <button
            type="button"
            className="btn btn-ghost confirm-cancel-btn"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger confirm-delete-btn"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '⏳ Deleting Permanently...' : '🗑️ Permanently Delete (Never Restore)'}
          </button>
        </div>
      </motion.div>

      <style>{`
        .confirm-delete-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(6px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .confirm-delete-modal {
          background: #FFFFFF;
          border: 1px solid #FCA5A5;
          border-radius: 20px;
          max-width: 460px;
          width: 100%;
          padding: 1.5rem;
          box-shadow: 0 20px 25px -5px rgba(239, 68, 68, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .confirm-delete-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .confirm-delete-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #FEF2F2;
          border: 1px solid #FEE2E2;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .confirm-delete-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #991B1B;
          margin: 0;
        }

        .confirm-delete-folder-box {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 12px 14px;
        }

        .confirm-folder-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0F172A;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .confirm-folder-stats {
          font-size: 0.78rem;
          color: #64748B;
          margin: 0;
        }

        .confirm-delete-warning-banner {
          background: #FFF1F2;
          border: 1px solid #FECDD3;
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .confirm-warning-text {
          font-size: 0.84rem;
          color: #BE123C;
          margin: 0;
        }

        .confirm-warning-subtext {
          font-size: 0.76rem;
          color: #9F1239;
          margin: 0;
          line-height: 1.4;
        }

        .confirm-delete-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 4px;
        }

        .confirm-cancel-btn {
          font-weight: 700;
          padding: 8px 16px;
        }

        .confirm-delete-btn {
          background: #DC2626 !important;
          color: white !important;
          border: none !important;
          font-weight: 800 !important;
          padding: 10px 18px !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
          transition: all 0.15s ease;
        }

        .confirm-delete-btn:hover {
          background: #B91C1C !important;
          transform: translateY(-1px);
        }

        @media (max-width: 480px) {
          .confirm-delete-modal {
            padding: 1.25rem;
            gap: 1rem;
          }

          .confirm-delete-actions {
            flex-direction: column-reverse;
            width: 100%;
          }

          .confirm-cancel-btn, .confirm-delete-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
