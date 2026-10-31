import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD') {
  const code = (currency || 'USD').trim().toUpperCase() || 'USD'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(code) ? code : 'USD',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`
  }
}

/**
 * An amount in a stated currency — or, when the currency is not known, just the number. It never guesses dollars:
 * a bare "$" in front of a rupee figure is exactly the mistake this exists to prevent.
 */
export function formatAmountIn(amount: number, currency?: string | null) {
  if (!currency || !currency.trim()) return Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return formatCurrency(amount, currency)
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
