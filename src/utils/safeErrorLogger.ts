import * as Sentry from '@sentry/vue'
import { supabase } from '../services/supabase.service'

const SECRET_KEY = /(password|token|jwt|authorization|cookie|email|phone|secret|apikey)/i
const EMAIL = /[\w.+-]+@[\w.-]+\.\w+/g
const JWT = /\beyJ[\w.-]+\b/g

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(EMAIL, '[redacted-email]')
      .replace(JWT, '[redacted-token]')
      .slice(0, 500)
  }

  if (Array.isArray(value)) return value.map(redact)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : redact(item),
      ]),
    )
  }

  return value
}

export async function reportSafeError(context: string, error: unknown) {
  const payload = {
    context: context.slice(0, 100),
    message: redact(error instanceof Error ? error.message : error),
    path: window.location.pathname,
  }

  Sentry.captureException(error, { tags: { context: payload.context } })

  // No console.error(error): evita exponer PII, JWT o detalles de Supabase.
  await supabase.functions.invoke('error-log', { body: payload })
}
