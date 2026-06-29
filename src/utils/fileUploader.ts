import { supabase } from '../services/supabase.service'

/**
 * Uploads a file (Blob or File) to Cloudflare R2 (production) or Supabase Storage (development).
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
  file: Blob | File,
  filename: string,
  contentType: string
): Promise<string> {
  const isProd = import.meta.env.PROD

  if (isProd) {
    // Production -> Cloudflare R2 via Vercel Serverless Function
    const response = await fetch(`/api/r2-presign?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`)
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to get upload signature')
    }

    const { uploadUrl, publicUrl } = await response.json()

    // HTTP PUT direct upload to Cloudflare R2
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType
      },
      body: file
    })

    if (!uploadResponse.ok) {
      throw new Error(`Cloudflare R2 upload failed with status: ${uploadResponse.status}`)
    }

    return publicUrl
  } else {
    // Development -> Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('imagenes-plataforma')
      .upload(filename, file, { contentType, upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('imagenes-plataforma').getPublicUrl(filename)
    return urlData.publicUrl
  }
}
