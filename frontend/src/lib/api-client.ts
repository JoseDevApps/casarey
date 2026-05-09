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

/**
 * 204 No Content (DELETE típico) y 304 Not Modified no traen cuerpo.
 * Devolver `undefined as T` evita `SyntaxError: Unexpected end of JSON input`
 * cuando el caller no espera resultado.
 */
async function parseBody<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 304) {
    return undefined as T
  }
  // Algunos servidores devuelven 200 con body vacío; intentamos defensivo.
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined as T
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
    return parseBody<T>(retry)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new APIError(
      res.status,
      (err as { code?: string }).code || 'ERROR',
      (err as { detail?: string }).detail || 'Request failed'
    )
  }

  return parseBody<T>(res)
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof APIError) return err.message
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Error inesperado'
}

export { apiFetch }
