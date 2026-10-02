export function coerceDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof value === 'object') {
    if ('toDate' in value && typeof (value as any).toDate === 'function') {
      const date = (value as any).toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
    }
    if ('seconds' in value && typeof (value as any).seconds === 'number') {
      const date = new Date((value as any).seconds * 1000);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
}

export function isWithinRange(value: unknown, start: Date, end: Date): boolean {
  const date = coerceDate(value);
  if (!date) return false;
  return date >= start && date <= end;
}

export function formatDateValue(value: unknown, pattern: string = 'yyyy-MM-dd HH:mm') {
  const date = coerceDate(value);
  if (!date) return '-';

  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());

  if (pattern === 'yyyy-MM-dd') return `${y}-${m}-${d}`;
  if (pattern === 'HH:mm') return `${hh}:${mm}`;
  if (pattern === 'd MMM yyyy') {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return `${y}-${m}-${d} ${hh}:${mm}`;
}
