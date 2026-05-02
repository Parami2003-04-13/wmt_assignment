import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import api from './api';

async function blobUriToDataUri(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result;
      if (typeof r === 'string') resolve(r);
      else reject(new Error('Unable to read the selected image.'));
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Produce a PNG/JPEG data URI suitable for `/api/uploads/image`.
 */
async function imageToDataUri(image: string): Promise<string> {
  const trimmed = image.trim();
  if (!trimmed) {
    throw new Error('Missing image.');
  }
  if (/^data:image\//i.test(trimmed)) {
    return trimmed;
  }
  if (Platform.OS === 'web') {
    return blobUriToDataUri(trimmed);
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(trimmed, { encoding: 'base64' });
    const lower = trimmed.split('?')[0]?.toLowerCase() ?? trimmed.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    throw new Error('Could not read the selected image.');
  }
}

/**
 * Ensures Cloudinary-hosted HTTPS URL before persisting in the backend.
 * Returns null for missing input. Pass-through for absolute http(s) URLs.
 */
export async function ensureRemoteImageUrl(
  image: string | null | undefined,
  folder: string
): Promise<string | null> {
  if (image == null) return null;
  const t = typeof image === 'string' ? image.trim() : '';
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    return t;
  }

  const dataUri = await imageToDataUri(t);
  const { data } = await api.post<{ url?: string }>('uploads/image', {
    image: dataUri,
    folder,
  });
  if (!data?.url || typeof data.url !== 'string') {
    throw new Error('Upload did not return an image URL.');
  }
  return data.url.trim();
}
