/** Image types accepted for logos and signatures. */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 512 * 1024;

/** Validates type, size and that the file really decodes as an image; resolves to a data URL. */
export const readImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return reject(new Error('Use a PNG, JPG or WebP image.'));
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error('Image must be 512 KB or smaller.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('This file is not a valid image.'));
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
