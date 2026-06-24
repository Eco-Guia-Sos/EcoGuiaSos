/**
 * Utilidad para comprimir y optimizar imágenes utilizando la API nativa de Canvas de HTML5.
 * Mantiene la relación de aspecto original de la imagen y escala proporcionalmente
 * si supera las dimensiones máximas (1200px por defecto).
 */
export async function compressImage(file: File, maxDimension: number = 1200, quality: number = 0.8): Promise<Blob> {
  // Retornar el archivo original si no es una imagen
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // No procesar GIFs animados para no perder la animación
  if (file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular dimensiones proporcionales
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // Fallback al archivo original si falla el contexto
        }

        // Dibujar imagen en el lienzo
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir lienzo a Blob (formato JPEG para compresión eficiente)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file); // Fallback
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        resolve(file); // Fallback en caso de error
      };
    };
    reader.onerror = () => {
      resolve(file); // Fallback
    };
  });
}
