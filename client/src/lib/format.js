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

const METHOD_LABEL = {
  reducing_balance: 'reducing balance',
  flat_rate: 'flat',
  simple_interest: 'simple interest',
  interest_only: 'interest only',
};

const RATE_BASIS_LABEL = {
  per_annum: 'per annum',
  per_term: 'per term',
  per_period: 'per period',
};

// Renders a product's rate faithfully to its configured method + basis,
// e.g. "25% flat per term" for Manifi's product, not an assumed "% APR".
export function formatRateBasis(rate, method, rateBasis) {
  const methodLabel = METHOD_LABEL[method] || method?.replace(/_/g, ' ') || '';
  const basisLabel = RATE_BASIS_LABEL[rateBasis] || rateBasis?.replace(/_/g, ' ') || '';
  return [`${rate}%`, methodLabel, basisLabel].filter(Boolean).join(' ');
}
