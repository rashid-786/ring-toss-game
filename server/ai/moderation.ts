/**
 * Local content moderation. Generated commentary must pass before it is
 * broadcast. Rejected or unsafe content falls back to local messages.
 */

const BLOCKLIST = [
  'hate',
  'racist',
  'idiot',
  'stupid',
  'loser',
  'gambling',
  'betting',
  'casino',
  'money',
  'salary',
  'fired',
  'bonus',
  'sex',
  'naked',
  'kill',
  'punch',
  'idiot',
];

export function moderateCommentary(text: string): boolean {
  const normalized = text.toLowerCase();
  return !BLOCKLIST.some((word) => normalized.includes(word));
}

/** Guards the commentary to one short sentence (max 100 chars where practical). */
export function truncateCommentary(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}...`;
}