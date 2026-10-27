const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const SUPPORTED_EXTENSION = /\.(jpe?g|png|webp)$/i;

export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

export function isSupportedImage(file: File): boolean {
  if (file.type) return SUPPORTED_TYPES.has(file.type.toLowerCase());
  return SUPPORTED_EXTENSION.test(file.name);
}

export function fileError(file: File): string | null {
  if (isSupportedImage(file)) return null;
  return `“${file.name || 'This file'}” isn’t a JPG, PNG, or WebP image.`;
}

export function outputName(name: string, extension: string): string {
  const base = name.replace(/\.[^./\\]+$/, '').trim() || 'image';
  return `${base}-no-bg.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
