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

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
