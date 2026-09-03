// INR money formatting, no decimals. Native Intl — no currency lib.
export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

// recoveryRate is a fraction 0..1. 0.437 -> "44%".
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}