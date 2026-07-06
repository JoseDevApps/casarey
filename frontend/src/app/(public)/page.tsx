import type { Property, CmsBanner } from '@/types/index'
import { LandingExperience } from './landing-experience'

async function getProperties(): Promise<Property[]> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8100'
    const res = await fetch(`${base}/properties?page_size=50`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? data ?? []
  } catch {
    return []
  }
}

async function getVisibleBanners(): Promise<CmsBanner[]> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8100'
    const res = await fetch(`${base}/cms/banners`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const items: CmsBanner[] = data?.items ?? data ?? []
    return items
      .filter((b) => b.is_visible && b.minio_key)
      .sort((a, b) => a.sort_order - b.sort_order)
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const [properties, banners] = await Promise.all([
    getProperties(),
    getVisibleBanners(),
  ])

  return <LandingExperience banners={banners} properties={properties} />
}
