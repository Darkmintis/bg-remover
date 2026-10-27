export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function coverRect(
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
): Rect {
  if (imageWidth <= 0 || imageHeight <= 0) return { x: 0, y: 0, width, height };

  const scale = Math.max(width / imageWidth, height / imageHeight);
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  return {
    x: (width - scaledWidth) / 2,
    y: (height - scaledHeight) / 2,
    width: scaledWidth,
    height: scaledHeight,
  };
}

export function canvasPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
): { x: number; y: number } {
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

  return {
    x: clamp(((clientX - rect.left) / rect.width) * width, 0, width),
    y: clamp(((clientY - rect.top) / rect.height) * height, 0, height),
  };
}
