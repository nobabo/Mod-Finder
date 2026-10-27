import { afterEach, describe, expect, it, vi } from 'vitest';
import { photoAverageColor } from '../../src/web/lib/photo-color';
afterEach(()=>vi.unstubAllGlobals());
describe('background photograph color',()=>{
  it('samples an image for contrast without changing its source',()=>{
    const pixels = new Uint8ClampedArray(16*16*4);
    for(let index=0;index<pixels.length;index+=4) pixels.set([210,160,80,255],index);
    const context={drawImage:vi.fn(),getImageData:()=>({data:pixels})};
    vi.stubGlobal('document',{createElement:()=>({getContext:()=>context})});
    const image={} as HTMLImageElement;
    expect(photoAverageColor(image)).toBe('#d2a050');
    expect(context.drawImage).toHaveBeenCalledWith(image,0,0,16,16);
  });
  it('leaves the previous contrast reference available when pixels cannot be read',()=>{
    vi.stubGlobal('document',{createElement:()=>({getContext:()=>null})});
    expect(photoAverageColor({} as HTMLImageElement)).toBeUndefined();
  });
});
