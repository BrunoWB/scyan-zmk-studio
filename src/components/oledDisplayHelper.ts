export const OLED_BORDER_UNITS = 5;

export const getCalculatedDisplayDim = (
  width: number,
  height: number,
  scale: number = 1
): { displayW: number; displayH: number } => {
  const w = width > 0 ? width : 32;
  const h = height > 0 ? height : 128;
  const aspect = w / h;

  let baseW: number;
  let baseH: number;

  if (aspect <= 1) {
    baseH = Math.round(192 * scale);
    baseW = Math.max(28, Math.min(Math.round(180 * scale), Math.round(baseH * aspect)));
  } else {
    baseW = Math.round(180 * scale);
    baseH = Math.max(28, Math.min(Math.round(192 * scale), Math.round(baseW / aspect)));
  }

  return { displayW: baseW, displayH: baseH };
};
