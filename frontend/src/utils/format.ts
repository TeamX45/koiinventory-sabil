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
