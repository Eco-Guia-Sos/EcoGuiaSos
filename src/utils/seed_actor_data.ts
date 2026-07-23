import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iiesxyviqhoxczydzeqa.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('1. Authenticating as actor_test@ecoguiasos.com...')
  let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'actor_test@ecoguiasos.com',
    password: 'Password123!'
  })

  if (authError || !authData.user) {
    console.log('Auth password failed, trying signup...')
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'actor_test@ecoguiasos.com',
      password: 'Password123!'
    })
    if (signUpError) {
      console.warn('SignUp error:', signUpError.message)
    }
    authData = signUpData as any
  }

  let userId = authData?.user?.id

  if (!userId) {
    console.log('Fetching profile for actor_test@ecoguiasos.com...')
    const { data: profile } = await supabase.from('perfiles').select('id, email').eq('email', 'actor_test@ecoguiasos.com').maybeSingle()
    userId = profile?.id
  }

  if (!userId) {
    const { data: anyUser } = await supabase.from('perfiles').select('id, email').limit(1).single()
    userId = anyUser?.id
    console.log('Fallback user ID:', userId)
  }

  console.log('Using User ID for records:', userId)

  // 1.5 Update complete profile information for the actor
  console.log('Updating profile info for actor_test...')
  const profilePayload = {
    nombre_completo: 'Colectivo Eco-Actores Roma Sur',
    bio: 'Organización comunitaria enfocada en la regeneración urbana, permacultura, y educación ambiental interactiva en la Ciudad de México.',
    telefono: '+525543210987',
    links_sociales: {
      web: 'https://huertoromaverde.org',
      facebook: 'https://facebook.com/ecoactoresroma',
      instagram: 'https://instagram.com/ecoactores_roma',
      twitter: 'https://x.com/ecoactores_cdmx',
      whatsapp: 'https://wa.me/525543210987'
    },
    videos_presentacion: [
      'https://www.youtube.com/watch?v=HuertoRomaVerdeIntro',
      'https://www.youtube.com/watch?v=TorneoCompostajeResumen'
    ],
    permitir_edicion_videos: true,
    zonas_impacto: ['Huerto Roma Verde', 'Parque México', 'Huerto Tlatelolco'],
    avatar_url: '/assets/img/secciones/lugares/huerto_roma.jpg',
    actor_status: 'approved'
  }

  const { error: profileError } = await supabase
    .from('perfiles')
    .update(profilePayload)
    .eq('id', userId)

  if (profileError) {
    console.error('Error updating profile:', profileError)
  } else {
    console.log('Profile updated successfully with biography, networks, and showcase metadata.')
  }

  // 2. Fetch Super Evento Agrolimpiadas ID
  const { data: superEvents } = await supabase.from('super_eventos').select('id, nombre').ilike('nombre', '%agro%').limit(1)
  const superEventoId = (superEvents && superEvents.length > 0 && superEvents[0]) ? superEvents[0].id : null
  console.log('Super Evento Agrolimpiadas ID:', superEventoId)

  // 3. Create Lugar in Huerto Roma Verde
  console.log('Creating Lugar: Centro de Recolección Huerto Roma Verde...')
  const lugarPayload = {
    nombre: 'Centro de Compostaje y Recolección Huerto Roma Verde',
    descripcion: 'Punto permanente de acopio de residuos orgánicos, aceite vegetal usado y e-waste en el corazón de la Colonia Roma. Ofrecemos talleres de bioconstrucción y separación de residuos.',
    categoria: 'Centro de Acopio / Reciclaje',
    ubicacion: 'Jalapa 234, Roma Sur, Cuauhtémoc, 06760 Ciudad de México, CDMX',
    lat: 19.408726,
    lng: -99.158708,
    owner_id: userId,
    estado: 'approved',
    imagen_url: '/assets/img/secciones/lugares/huerto_roma.jpg'
  }

  const { data: lugarData, error: lugarError } = await supabase.from('lugares').insert([lugarPayload]).select()
  if (lugarError) {
    console.error('Error inserting lugar:', lugarError)
  } else {
    console.log('Lugar inserted successfully:', lugarData[0].id, lugarData[0].nombre)
  }

  // 4. Create Event affiliated to Agrolimpiadas
  console.log('Creating Subevento affiliated to Agrolimpiadas...')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 2)
  tomorrow.setHours(10, 0, 0, 0)

  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setHours(14, 0, 0, 0)

  const eventoAgroPayload = {
    nombre: 'Torneo de Compostaje Rápido & Huertos Urbanos - Agrolimpiadas 2026',
    descripcion: 'Compite en equipos para armar la pila de compost de maduración acelerada más eficiente y aprende técnicas avanzadas de cultivo agroecológico urbano.',
    categoria: 'Taller',
    modalidad: 'presencial',
    ubicacion: 'Huerto Roma Verde - Jalapa 234, Roma Sur, CDMX',
    lat: 19.408726,
    lng: -99.158708,
    es_gratuito: true,
    pet_friendly: true,
    apto_ninos: true,
    fecha_inicio: tomorrow.toISOString(),
    fecha_fin: tomorrowEnd.toISOString(),
    super_evento_id: superEventoId,
    owner_id: userId,
    estado: 'approved',
    imagen_url: '/assets/img/secciones/super-eventos/agrolimpiadas.jpeg',
    reg_link: 'https://ecoguiasos.org/registro-agrolimpiadas',
    social_ig: 'https://instagram.com/huertoromaverde'
  }

  const { data: evData, error: evError } = await supabase.from('eventos').insert([eventoAgroPayload]).select()
  if (evError) {
    console.error('Error inserting subevento Agrolimpiadas:', evError)
  } else {
    console.log('Subevento Agrolimpiadas inserted successfully:', evData[0].id, evData[0].nombre)
  }

  // 5. Create a Complete Showcase Event (with all fields filled)
  console.log('Creating Showcase Event with all fields completed...')
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 5)
  nextWeek.setHours(16, 0, 0, 0)

  const nextWeekEnd = new Date(nextWeek)
  nextWeekEnd.setHours(19, 0, 0, 0)

  const eventoShowcasePayload = {
    nombre: 'Cumbre de Restauración Ecológica & Bioeconomía CDMX',
    descripcion: 'Encuentro híbrido internacional con conferencias magistrales, exhibición de tecnologías sustentables, networking con proyectos socioambientales y talleres prácticos para la restauración de microcuencas urbanas.',
    categoria: 'Conferencia / Foro',
    modalidad: 'presencial',
    tiene_sesion_online: true,
    ubicacion: 'Huerto Roma Verde & Transmisión en Vivo - Jalapa 234, CDMX',
    lat: 19.408726,
    lng: -99.158708,
    sesion_online_link: 'https://meet.google.com/eco-cumbre-2026',
    reg_link: 'https://ecoguiasos.org/cumbre-restauracion',
    social_fb: 'https://facebook.com/ecoguiasos',
    social_ig: 'https://instagram.com/ecoguiasos',
    social_wa: 'https://wa.me/525512345678',
    social_x: 'https://x.com/ecoguiasos',
    social_yt: 'https://youtube.com/@ecoguiasos',
    social_web: 'https://ecoguiasos.org',
    es_gratuito: true,
    pet_friendly: true,
    apto_ninos: true,
    fecha_inicio: nextWeek.toISOString(),
    fecha_fin: nextWeekEnd.toISOString(),
    owner_id: userId,
    estado: 'approved',
    imagen_url: '/assets/img/secciones/eventos/cumbre_restauracion.jpg',
    drive_fotos_url: 'https://drive.google.com/drive/folders/eco-guiasos-2026',
    clave_fotos: 'ECO2026'
  }

  const { data: showData, error: showError } = await supabase.from('eventos').insert([eventoShowcasePayload]).select()
  if (showError) {
    console.error('Error inserting Showcase Event:', showError)
  } else {
    console.log('Showcase Event inserted successfully:', showData[0].id, showData[0].nombre)
  }
}

run()
