import { ref } from 'vue'
import { z } from 'zod'

export const useValidation = () => {
  const validateForm = <T>(schema: z.ZodTypeAny, data: unknown): { valid: boolean, errors: Record<string, string> } => {
    try {
      schema.parse(data)
      return { valid: true, errors: {} }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.issues.forEach((issue) => {
          const path = issue.path.join('.')
          errors[path] = issue.message
        })
        return { valid: false, errors }
      }
      return { valid: false, errors: { form: 'Error de validación desconocido' } }
    }
  }

  return { validateForm }
}
