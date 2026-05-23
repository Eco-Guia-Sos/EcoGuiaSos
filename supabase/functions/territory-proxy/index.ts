import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts"
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts"

serve(async (req) => {
  // Preflight
  const preflight = corsPreflightResponse(req)
  if (preflight) return preflight

  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    
    // Rate limit por IP
    const { allowed, retryAfter } = await checkRateLimit(ip, 'public')
    if (!allowed) return rateLimitResponse(retryAfter)

    const { type, state, municipality } = await req.json()
    const apiKey = Deno.env.get('INEGI_API_KEY')
    
    // Lógica de llamada a INEGI
    let targetUrl = ""
    if (type === 'estados') {
      targetUrl = `https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/1002000001/es/0700/true/BISE/${apiKey}?type=json`
    } else if (type === 'municipios' && state) {
      // INEGI usa claves de entidad de 2 dígitos
      const stateCode = String(state).padStart(2, '0')
      targetUrl = `https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/1002000001/es/07000001/true/BISE/${apiKey}?type=json`
    }

    let resultData = {}
    if (apiKey && targetUrl) {
      const inegiRes = await fetch(targetUrl)
      if (inegiRes.ok) {
        resultData = await inegiRes.json()
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: resultData }),
      {
        headers: {
          ...getCorsHeaders(req),
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Territory proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          ...getCorsHeaders(req),
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
