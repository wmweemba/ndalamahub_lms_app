export function formatCurrency(amount) {
  return `K${Number(amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const UNIT_SINGULAR = {
  days: 'day',
  weeks: 'week',
  months: 'month',
};

export function formatTerm(term, termUnit = 'months') {
  const unit = UNIT_SINGULAR[termUnit] || termUnit;
  return `${term} ${term === 1 ? unit : `${unit}s`}`;
}
