import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string): string {
  return `${Number(amount).toFixed(2)} Bs`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function getImageUrl(minioKey: string, bucket: string = 'property-images'): string {
  // Relative path: rewritten by Next.js to internal http://minio:9000 (see next.config.ts)
  // Same-origin, so HTTPS works automatically when the site is served over HTTPS
  return `/minio/${bucket}/${minioKey}`
}

export function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
