/**
 * client/src/components/TimelineHistory.jsx
 * Combined chronological activity timeline history component — supports both files and text transfers
 */

import { AnimatePresence } from 'framer-motion';
import { FileCard } from './FileCard';
import { TextShare } from './TextShare';

export function TimelineHistory({
  items,
  combinedHistory,
  onDeleteFile,
  onDeleteText,
  onTogglePrint,
}) {
  const historyList = items || combinedHistory || [];

  if (historyList.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">📜</span>
        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
          Transfer History Empty
        </p>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          No file or text transfers logged in this session
        </p>
      </div>
    );
  }

  return (
    <div className="file-list flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {historyList.map((item) => {
          const isFile =
            item._type === 'file' ||
            item.itemType === 'file' ||
            Boolean(item.originalName || item.originalname || item.mimeType || item.size);

          const itemId = item.uuid || item.id || item._id;

          return isFile ? (
            <FileCard
              key={itemId}
              file={item}
              onDelete={onDeleteFile}
              onTogglePrint={onTogglePrint}
            />
          ) : (
            <TextShare
              key={itemId}
              textRecord={item}
              onDelete={onDeleteText}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
