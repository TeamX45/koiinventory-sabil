export const formatRp = (n: number | string | null | undefined) =>
  n == null
    ? '-'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(typeof n === 'string' ? parseFloat(n) : n);

export const formatDate = (s?: string | null) =>
  !s ? '-' : new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatNumber = (n: number | string | null | undefined) =>
  n == null ? '-' : new Intl.NumberFormat('id-ID').format(typeof n === 'string' ? parseFloat(n) : n);

/**
 * Parse harga ramah-input.
 * Contoh:
 *   "1.5 jt"  → 1500000
 *   "1,5 jt"  → 1500000
 *   "350 rb"  → 350000
 *   "2jt"     → 2000000
 *   "150000"  → 150000
 *   "150rb"   → 150000
 */
export const parsePrice = (input: string): number | null => {
  if (!input) return null;
  const cleaned = input.toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(jt|juta|rb|ribu|k)?$/);
  if (!match) {
    const raw = parseFloat(cleaned.replace(/[^\d.]/g, ''));
    return Number.isFinite(raw) ? raw : null;
  }
  const value = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === 'jt' || suffix === 'juta') return Math.round(value * 1_000_000);
  if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') return Math.round(value * 1_000);
  return Math.round(value);
};

/**
 * Format harga jadi string ringkas: 1500000 → "1,5 jt", 350000 → "350 rb"
 */
export const formatRpShort = (n: number | string | null | undefined): string => {
  if (n == null) return '-';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(v)) return '-';
  if (v >= 1_000_000) {
    const jt = v / 1_000_000;
    const s = Number.isInteger(jt) ? String(jt) : jt.toFixed(1).replace('.', ',');
    return `${s} jt`;
  }
  if (v >= 1_000) {
    const rb = v / 1_000;
    const s = Number.isInteger(rb) ? String(rb) : rb.toFixed(1).replace('.', ',');
    return `${s} rb`;
  }
  return new Intl.NumberFormat('id-ID').format(v);
};

/**
 * Format ukuran ikan. min+max → "25–35 cm", min only → "30 cm".
 */
export const formatSize = (min?: number | null, max?: number | null): string => {
  if (!min && !max) return '-';
  if (min && max && min !== max) return `${min}–${max} cm`;
  return `${min ?? max} cm`;
};
