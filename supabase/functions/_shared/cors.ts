export const getCorsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get('origin') || ''
  
  // Orígenes permitidos
  const allowedOrigins = [
    'https://ecoguia-sos.com', // Producción
    'https://www.ecoguia-sos.com',
    'http://localhost:5173', // Desarrollo local Vite
    'http://localhost:3000', // Fallback
  ]

  const isAllowed = allowedOrigins.some(allowed => 
    allowed === origin || (allowed.includes('localhost') && origin.includes('localhost'))
  )

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }
}

export const corsPreflightResponse = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    })
  }
  return null
}
