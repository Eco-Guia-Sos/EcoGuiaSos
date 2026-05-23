import { z } from 'zod'

// Validación de formularios de eventos
export const EventoSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z.string().max(1000, 'Máximo 1000 caracteres'),
  categoria: z.string().min(1, 'Selecciona una categoría'),
  ubicacion: z.string().min(1, 'La ubicación es requerida'),
  lat: z.number().min(-90).max(90, 'Latitud inválida'),
  lng: z.number().min(-180).max(180, 'Longitud inválida'),
  es_gratuito: z.boolean(),
  pet_friendly: z.boolean(),
  apto_ninos: z.boolean(),
  fecha_inicio: z.string().datetime('Fecha de inicio inválida'),
  fecha_fin: z.string().datetime('Fecha de fin inválida'),
}).strict()

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
  links_sociales: z.record(z.string(), z.string().url('URL inválida')).nullable().optional(),
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
}).strict()

// Validación de inicio de sesión / registro
export const AuthSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener una mayúscula')
    .regex(/[0-9]/, 'Debe contener un número'),
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
