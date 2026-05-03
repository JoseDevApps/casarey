export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options })

  if (res.status === 401) {
    // Try refresh
    const refresh = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    if (!refresh.ok) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new APIError(401, 'UNAUTHORIZED', 'Session expired')
    }
    // Retry original
    const retry = await fetch(url, { credentials: 'include', ...options })
    if (!retry.ok) {
      const err = await retry.json().catch(() => ({}))
      throw new APIError(
        retry.status,
        (err as { code?: string }).code || 'ERROR',
        (err as { detail?: string }).detail || 'Request failed'
      )
    }
    return retry.json() as Promise<T>
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new APIError(
      res.status,
      (err as { code?: string }).code || 'ERROR',
      (err as { detail?: string }).detail || 'Request failed'
    )
  }

  return res.json() as Promise<T>
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Error inesperado'
}

export { apiFetch }
