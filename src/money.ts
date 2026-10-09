// Set VITE_CURRENCY in .env.local (e.g. INR, EUR) to change the display currency.
const currency = (import.meta.env.VITE_CURRENCY as string | undefined) || 'USD'
const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency })
const fmtWhole = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 })

export function formatCents(cents: number): string {
  return fmt.format(cents / 100)
}

/** Rounded to whole units, for headline numbers. */
export function formatWhole(cents: number): string {
  return fmtWhole.format(Math.round(cents / 100))
}

/** Parses user input like "1,234.5" or "$12" into integer cents; null if invalid. */
export function parseCents(input: string): number | null {
  // Drop a leading currency symbol plus thousands separators/spaces.
  const cleaned = input.trim().replace(/^[^\d.]+/, '').replace(/[,\s]/g, '')
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
