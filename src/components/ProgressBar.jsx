/**
 * client/src/components/ProgressBar.jsx
 * Animated upload progress bar
 */

export function ProgressBar({ percent }) {
  return (
    <div className="upload-progress-wrapper">
      <div className="progress-bar-wrapper">
        <div
          className="progress-bar-fill"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className="progress-percent">{percent}%</span>

      <style>{`
        .upload-progress-wrapper {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
        }
        .upload-progress-wrapper .progress-bar-wrapper {
          flex: 1;
        }
        .progress-percent {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--accent-secondary);
          min-width: 32px;
          text-align: right;
        }
      `}</style>
    </div>
  );
}
