import { getSupabase } from './supabase';

export const MEDIA_URL = (import.meta.env.PUBLIC_MEDIA_URL || 'https://media.civpulse.org').replace(/\/$/, '');

export function validateProfileImage(file: File): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('Choose an image of 2 MB or smaller.');
}

export async function uploadProfileImage(bucket: 'org-logos' | 'person-images', file: File): Promise<string> {
  validateProfileImage(file);
  const { data: { session } } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Sign in again to upload an image.');
  const response = await fetch(`${MEDIA_URL}/upload?bucket=${bucket}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': file.type },
    body: file,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Image upload failed. Please try again.');
  return result.path;
}

/** Preview the selected file; restore the saved image on reset/cancel. */
export function initImagePreview(input: HTMLInputElement | null, preview: HTMLImageElement | null, reportError: (message: string) => void): () => void {
  let objectUrl: string | null = null;
  const clear = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file || !preview) return;
    try {
      validateProfileImage(file);
      clear();
      objectUrl = URL.createObjectURL(file);
      preview.src = objectUrl;
      preview.hidden = false;
    } catch (error) {
      input.value = '';
      reportError(error instanceof Error ? error.message : 'Invalid image.');
    }
  });
  return clear;
}
