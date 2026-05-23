import { Redis } from "https://deno.land/x/upstash_redis@v1.28.0/mod.ts"

const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL')
const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

// Lazy initialization or fallback if env vars are missing
let redis: any = null
if (redisUrl && redisToken) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  })
}

interface RateLimitConfig {
  windowMs: number // Ventana de tiempo en ms
  maxRequests: number // Máximo de requests en la ventana
}

const configs = {
  public: { windowMs: 60000, maxRequests: 30 }, // 30 req/min por IP pública
  authenticated: { windowMs: 60000, maxRequests: 10 }, // 10 req/min por usuario autenticado
  write: { windowMs: 60000, maxRequests: 5 }, // 5 writes/min
}

export const checkRateLimit = async (
  identifier: string, // IP o user_id
  configType: 'public' | 'authenticated' | 'write' = 'public'
): Promise<{ allowed: boolean; retryAfter: number }> => {
  const config = configs[configType]
  const key = `ratelimit:${identifier}:${configType}`
  
  try {
    if (!redis) {
      // Fallback seguro si Redis no está configurado
      return { allowed: true, retryAfter: 0 }
    }

    const current = await redis.incr(key)
    
    if (current === 1) {
      // Primera request en esta ventana
      await redis.expire(key, Math.ceil(config.windowMs / 1000))
    }

    if (current > config.maxRequests) {
      const ttl = await redis.ttl(key)
      return { allowed: false, retryAfter: ttl || 60 }
    }

    return { allowed: true, retryAfter: 0 }
  } catch (error) {
    console.error('Rate limit check error:', error)
    // En caso de error, permitir la request (fallback seguro)
    return { allowed: true, retryAfter: 0 }
  }
}

export const rateLimitResponse = (retryAfter: number): Response => {
  return new Response(
    JSON.stringify({ error: 'Too many requests' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  )
}
