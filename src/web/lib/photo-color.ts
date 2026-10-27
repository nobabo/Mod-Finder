import { colorHex } from './background-color';

export function photoAverageColor(image: HTMLImageElement): string | undefined {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const context = canvas.getContext('2d', { willReadFrequently:true });
    if (!context) return undefined;
    context.drawImage(image,0,0,16,16);
    const pixels = context.getImageData(0,0,16,16).data;
    let r = 0, g = 0, b = 0;
    for (let index = 0; index < pixels.length; index += 4) { r += pixels[index]; g += pixels[index+1]; b += pixels[index+2]; }
    return colorHex({r:r/256,g:g/256,b:b/256,a:1});
  } catch { return undefined; }
}
