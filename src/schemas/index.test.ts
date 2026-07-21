import { describe, expect, it } from 'vitest'
import { AuthSchema, EventoSchema, LoginSchema, LugarSchema } from './index'

const validEvent = {
  nombre: 'Jornada de reforestación',
  descripcion: 'Actividad comunitaria',
  categoria: 'ambiental',
  modalidad: 'presencial',
  tiene_sesion_online: false,
  ubicacion: 'Parque México',
  lat: 19.412,
  lng: -99.17,
  reg_link: '',
  sesion_online_link: '',
  social_fb: '',
  social_ig: '',
  social_wa: '',
  social_x: '',
  social_yt: '',
  social_web: '',
  es_gratuito: true,
  pet_friendly: true,
  apto_ninos: true,
  fecha_inicio: '2026-08-01T10:00:00.000Z',
  fecha_fin: '2026-08-01T14:00:00.000Z',
  drive_fotos_url: '',
  clave_fotos: '',
}

describe('schemas', () => {
  it('acepta un evento presencial válido', () => {
    expect(EventoSchema.safeParse(validEvent).success).toBe(true)
  })

  it('rechaza evento presencial sin ubicación ni coordenadas', () => {
    const result = EventoSchema.safeParse({
      ...validEvent,
      ubicacion: '',
      lat: null,
      lng: null,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path[0])).toEqual(
        expect.arrayContaining(['ubicacion', 'lat', 'lng']),
      )
    }
  })

  it('exige enlace para evento virtual', () => {
    const result = EventoSchema.safeParse({
      ...validEvent,
      modalidad: 'en_linea',
      ubicacion: null,
      lat: null,
      lng: null,
      sesion_online_link: '',
    })

    expect(result.success).toBe(false)
  })

  it('rechaza coordenadas fuera de rango en lugares', () => {
    expect(LugarSchema.safeParse({
      nombre: 'Centro ecológico',
      descripcion: 'Punto de reciclaje',
      categoria: 'reciclaje',
      ubicacion: 'CDMX',
      lat: 91,
      lng: -181,
    }).success).toBe(false)
  })

  it('rechaza campos adicionales en lugares', () => {
    expect(LugarSchema.safeParse({
      nombre: 'Centro ecológico',
      descripcion: 'Punto de reciclaje',
      categoria: 'reciclaje',
      ubicacion: 'CDMX',
      lat: 19.4,
      lng: -99.1,
      rol: 'admin',
    }).success).toBe(false)
  })

  it('distingue registro de inicio de sesión', () => {
    expect(AuthSchema.safeParse({
      email: 'persona@ejemplo.mx',
      password: 'ClaveSegura1',
    }).success).toBe(true)

    expect(AuthSchema.safeParse({
      email: 'persona@ejemplo.mx',
      password: 'simple',
    }).success).toBe(false)

    expect(LoginSchema.safeParse({
      email: 'persona@ejemplo.mx',
      password: 'simple',
    }).success).toBe(true)
  })
})
