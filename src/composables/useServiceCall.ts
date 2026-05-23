import * as Sentry from '@sentry/vue'

export const useServiceCall = () => {
  const call = async <T>(
    fn: () => Promise<T>,
    friendlyErrorMessage: string = 'Ocurrió un error. Por favor, intenta de nuevo.'
  ): Promise<{ data: T | null; error: string | null }> => {
    try {
      const result = await fn()
      return { data: result, error: null }
    } catch (err: any) {
      // Loggear a Sentry el error real (para debugging)
      Sentry.captureException(err, {
        tags: { source: 'service_call' },
      })

      // Retornar mensaje amigable al usuario (nunca el error raw de PostgreSQL)
      console.error('Service call error:', err)
      return { data: null, error: friendlyErrorMessage }
    }
  }

  return { call }
}
