export const APP_NAME = 'FECC Candidate Onboarding';
export const APP_SHORT_NAME = 'FECC Onboarding';
export const LOGO_SRC = '/logo.svg';
export const SAMPLE_SHEET_URL = '/sample/fecc-candidates-sample.xlsx';

export const DEFAULT_SUGGESTION_CHIPS = [
  { id: '1', text: 'Give me an onboarding summary', category: 'summary' },
  { id: '2', text: 'Who has not completed the pre-onboarding checklist?', category: 'pre' },
  { id: '3', text: 'Who is pending post-onboarding?', category: 'post' },
  { id: '4', text: 'Which candidates still have required courses pending?', category: 'courses' },
  { id: '5', text: 'List the release candidates', category: 'release' },
  { id: '6', text: 'Which course has the most pending candidates?', category: 'courses' },
];

/** "01 Oct 2026, 4:05 PM" in the viewer's own time zone. */
export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ymd || '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(iso, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
