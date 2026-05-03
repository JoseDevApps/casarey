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
  const base = process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9100'
  return `${base}/${bucket}/${minioKey}`
}

export function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
