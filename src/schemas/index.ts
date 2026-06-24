import { z } from 'zod'

// Validación de formularios de eventos
export const EventoSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z.string().max(1000, 'Máximo 1000 caracteres'),
  categoria: z.string().min(1, 'Selecciona una categoría'),
  modalidad: z.string().default('presencial'),
  tiene_sesion_online: z.boolean().default(false),
  ubicacion: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  reg_link: z.string().url('Enlace de registro inválido').optional().nullable().or(z.literal('')),
  sesion_online_link: z.string().url('Enlace de sesión en línea inválido').optional().nullable().or(z.literal('')),
  social_fb: z.string().url('URL de Facebook inválida').optional().nullable().or(z.literal('')),
  social_ig: z.string().url('URL de Instagram inválida').optional().nullable().or(z.literal('')),
  social_wa: z.string().url('URL de WhatsApp inválida').optional().nullable().or(z.literal('')),
  social_x: z.string().url('URL de X (Twitter) inválida').optional().nullable().or(z.literal('')),
  social_yt: z.string().url('URL de YouTube inválida').optional().nullable().or(z.literal('')),
  social_web: z.string().url('URL de Sitio Web inválida').optional().nullable().or(z.literal('')),
  es_gratuito: z.boolean(),
  pet_friendly: z.boolean(),
  apto_ninos: z.boolean(),
  fecha_inicio: z.string().datetime('Fecha de inicio inválida'),
  fecha_fin: z.string().datetime('Fecha de fin inválida'),
  drive_fotos_url: z.string().url('Enlace de Drive inválido').optional().nullable().or(z.literal('')),
  clave_fotos: z.string().optional().nullable().or(z.literal('')),
}).superRefine((data, ctx) => {
  // Regla 1: Presenciales DEBEN tener ubicación y coords
  if (data.modalidad === 'presencial') {
    if (!data.ubicacion?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ubicacion'],
        message: 'La ubicación es requerida para eventos presenciales',
      })
    }
    if (data.lat == null || isNaN(data.lat)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lat'],
        message: 'La latitud es requerida para eventos presenciales',
      })
    }
    if (data.lng == null || isNaN(data.lng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lng'],
        message: 'La longitud es requerida para eventos presenciales',
      })
    }
  }

  // Regla 2: En línea Y presenciales con sesión online (híbridos) DEBEN tener sesion_online_link
  if (data.modalidad === 'en_linea' || data.tiene_sesion_online) {
    if (!data.sesion_online_link?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sesion_online_link'],
        message: 'El enlace de la sesión en línea es obligatorio para eventos virtuales o híbridos',
      })
    }
  }
})

// Validación de formularios de lugares
export const LugarSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z.string().max(1000, 'Máximo 1000 caracteres'),
  categoria: z.string().min(1, 'Selecciona una categoría'),
  ubicacion: z.string().min(1, 'La ubicación es requerida'),
  lat: z.number().min(-90).max(90, 'Latitud inválida'),
  lng: z.number().min(-180).max(180, 'Longitud inválida'),
}).strict()

// Validación de perfiles de usuario
export const PerfilSchema = z.object({
  nombre_completo: z.string().max(80).nullable().optional(),
  rol: z.string().max(30).nullable().optional(),
  avatar_url: z.string().max(500).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  telefono: z.string().regex(/^[0-9+\-()]*$/, 'Teléfono inválido').nullable().optional(),
  links_sociales: z.record(z.string(), z.string().url('URL inválida').or(z.literal(''))).nullable().optional(),
  especialidad: z.string().max(100).nullable().optional(),
  organizacion: z.string().max(100).nullable().optional(),
  mision: z.string().max(300).nullable().optional(),
  descripcion: z.string().max(1000).nullable().optional(),
  impacto_resumen: z.string().max(200).nullable().optional(),
  alcaldia: z.string().max(100).nullable().optional(),
  zona: z.string().max(100).nullable().optional(),
  redes_ig: z.string().max(500).nullable().optional(),
  redes_fb: z.string().max(500).nullable().optional(),
  redes_x: z.string().max(500).nullable().optional(),
  redes_web: z.string().max(500).nullable().optional(),
  redes_wa: z.string().max(100).nullable().optional(),
  videos_presentacion: z.array(z.string().url()).max(5).nullable().optional(),
  permitir_edicion_videos: z.boolean().nullable().optional(),
  zonas_impacto: z.array(z.string()).nullable().optional(),
}).passthrough() // Permite campos adicionales de la BD (habilidades, causas_interes, etc.)

// Validación de inicio de sesión / registro
export const AuthSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(6, 'Mínimo 6 caracteres')
    .regex(/[A-Z]/, 'Debe contener una mayúscula')
    .regex(/[0-9]/, 'Debe contener un número'),
}).strict()

// Schema para LOGIN — sin validación de complejidad (solo email y password básico)
export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
}).strict()

// Validación de contenidos del Atlas
export const ContenidoSeccionSchema = z.object({
  titulo: z.string().max(150),
  descripcion: z.string().max(2000),
}).strict()

// Validación de slides del carrusel
export const CarruselSchema = z.object({
  titulo: z.string().max(80),
  subtitulo: z.string().max(120),
  enlace_url: z.string().url('URL inválida').optional().or(z.literal('')),
  badge: z.string().max(30).optional(),
}).strict()

export type Evento = z.infer<typeof EventoSchema>
export type Lugar = z.infer<typeof LugarSchema>
export type Perfil = z.infer<typeof PerfilSchema>
export type Auth = z.infer<typeof AuthSchema>
export type Login = z.infer<typeof LoginSchema>
