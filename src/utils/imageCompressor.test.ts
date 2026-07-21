// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from './imageCompressor'

const drawImage = vi.fn()
const canvasContext = { drawImage } as unknown as CanvasRenderingContext2D

class MockFileReader {
  result = 'data:image/png;base64,test'
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null
  onerror: (() => void) | null = null

  readAsDataURL() {
    queueMicrotask(() => this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>))
  }
}

class MockImage {
  width = 2400
  height = 1200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

describe('compressImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('no transforma archivos que no son imágenes', async () => {
    const file = new File(['texto'], 'archivo.txt', { type: 'text/plain' })

    await expect(compressImage(file)).resolves.toBe(file)
  })

  it('conserva GIF para no perder animación', async () => {
    const file = new File(['gif'], 'animado.gif', { type: 'image/gif' })

    await expect(compressImage(file)).resolves.toBe(file)
  })

  it('limita el lado más largo a 1200 px y exporta JPEG', async () => {
    vi.stubGlobal('FileReader', MockFileReader)
    vi.stubGlobal('Image', MockImage)

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: any) => {
      callback(new Blob(['compressed'], { type: 'image/jpeg' }))
    })

    const file = new File(['image'], 'foto.png', { type: 'image/png' })
    const result = await compressImage(file)

    expect(result.type).toBe('image/jpeg')
    expect(drawImage).toHaveBeenCalledWith(expect.any(MockImage), 0, 0, 1200, 600)
  })

  it('devuelve el original si Canvas no está disponible', async () => {
    vi.stubGlobal('FileReader', MockFileReader)
    vi.stubGlobal('Image', MockImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const file = new File(['image'], 'foto.png', { type: 'image/png' })

    await expect(compressImage(file)).resolves.toBe(file)
  })
})
