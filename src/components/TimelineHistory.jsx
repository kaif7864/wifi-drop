/**
 * client/src/components/TimelineHistory.jsx
 * Combined chronological timeline history component
 */

import { AnimatePresence } from 'framer-motion';
import { FileCard } from './FileCard';
import { TextShare } from './TextShare';

export function TimelineHistory({ combinedHistory, onDeleteFile, onDeleteText }) {
  if (combinedHistory.length === 0) {
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
    <div className="file-list">
      <AnimatePresence mode="popLayout">
        {combinedHistory.map((item) => (
          item.itemType === 'file' ? (
            <FileCard key={item.id} file={item} onDelete={onDeleteFile} />
          ) : (
            <TextShare key={item.id} textRecord={item} onDelete={onDeleteText} />
          )
        ))}
      </AnimatePresence>
    </div>
  );
}
