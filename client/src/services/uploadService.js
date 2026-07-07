import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/firebase/config';

/**
 * Compresses an image in the browser (canvas) before upload —
 * keeps Storage costs down and product grids fast.
 */
export function compressImage(file, maxDim = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed.'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Could not load the selected image.'));
    img.src = url;
  });
}

/** Uploads a (compressed) product image and returns its download URL. */
export async function uploadProductImage(file, productKey) {
  const blob = await compressImage(file);
  const path = `products/${productKey}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

export async function uploadStoreLogo(file) {
  const blob = await compressImage(file, 400, 0.9);
  const storageRef = ref(storage, `settings/logo-${Date.now()}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

export async function deleteImageByUrl(url) {
  try {
    await deleteObject(ref(storage, url));
  } catch {
    /* image already gone — ignore */
  }
}
