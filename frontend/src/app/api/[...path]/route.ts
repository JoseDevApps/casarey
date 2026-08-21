import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8100'

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const backendPath = path.join('/')

  // Preserve query string
  const search = req.nextUrl.search

  const url = `${BACKEND_URL}/${backendPath}${search}`

  const isMultipart = req.headers.get('content-type')?.includes('multipart/form-data')

  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Use arrayBuffer for multipart so fetch doesn't regenerate a mismatched boundary
    body = isMultipart ? await req.arrayBuffer() : await req.text()
  }

  const headers: HeadersInit = {
    Cookie: req.headers.get('cookie') || '',
  }

  // Cabeceras que el backend necesita ver intactas. X-Hub-Signature-256 es la
  // firma HMAC con que Meta firma los webhooks de WhatsApp: sin ella el backend
  // rechaza la peticion cuando WHATSAPP_APP_SECRET esta configurado.
  for (const name of ['x-hub-signature-256', 'x-hub-signature', 'user-agent']) {
    const value = req.headers.get(name)
    if (value) headers[name] = value
  }

  // Forward original Content-Type (including multipart boundary) so backend can parse the body
  const ct = req.headers.get('content-type')
  if (ct) headers['Content-Type'] = ct

  const backendRes = await fetch(url, {
    method: req.method,
    headers,
    body,
  })

  const noBody = backendRes.status === 204 || backendRes.status === 304
  const responseBody = noBody ? null : await backendRes.arrayBuffer()

  const responseInit: ResponseInit = { status: backendRes.status }
  if (!noBody) {
    responseInit.headers = {
      'Content-Type': backendRes.headers.get('Content-Type') || 'application/json',
    }
  }

  // NextResponse rejects 204/304 with a body; use native Response for those
  const response: Response = noBody
    ? new Response(null, responseInit)
    : new NextResponse(responseBody, responseInit)

  // Forward all set-cookie headers (logout sends two deletion headers)
  const setCookies = backendRes.headers.getSetCookie?.() ?? []
  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie)
  }
  if (setCookies.length === 0) {
    const setCookie = backendRes.headers.get('set-cookie')
    if (setCookie) response.headers.set('set-cookie', setCookie)
  }

  return response
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
}
