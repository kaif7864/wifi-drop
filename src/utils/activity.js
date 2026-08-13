/**
 * client/src/utils/activity.js
 * Calculates exact calendar day activity (Last 7 Days) for Dashboard and Analytics pages.
 * Ensures 100% consistency between Overview and Reports charts.
 */

export function getLast7DaysActivity(files = [], texts = []) {
  const now = new Date();
  const days = [];

  // Build last 7 calendar days starting from 6 days ago up to today
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = d.toDateString();
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

    // Count files uploaded on this exact calendar day
    const fileCount = files.filter((f) => {
      if (!f) return false;
      const fDate = new Date(f.savedAt || f.createdAt || f.timestamp);
      return fDate.toDateString() === dateStr;
    }).length;

    // Count texts received on this exact calendar day
    const textCount = texts.filter((t) => {
      if (!t) return false;
      const tDate = new Date(t.receivedAt || t.createdAt || t.timestamp);
      return tDate.toDateString() === dateStr;
    }).length;

    const totalCount = fileCount + textCount;

    days.push({
      day: dayName,
      label: dayName,
      count: totalCount,
      value: totalCount,
      fileCount,
      textCount,
      dateStr,
    });
  }

  const max = Math.max(...days.map((d) => d.count), 1);

  return days.map((d) => ({
    ...d,
    pct: Math.round((d.count / max) * 100),
  }));
}
