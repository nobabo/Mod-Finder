import { themeById } from './themes';
// A shared scene is sampled again through rounded glass lenses. Unlike backdrop
// blur, the surface changes sample coordinates, dispersion and specular response.
const vertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;
const fragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPhotoA;
uniform sampler2D uPhotoB;
uniform vec2 uSize;
uniform vec4 uView;
uniform vec2 uImageA;
uniform vec2 uImageB;
uniform float uTime;
uniform float uMix;
uniform float uMotion;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec2 uPointer;
uniform vec2 uBackgroundOffset;
uniform vec4 uPanels[8];
uniform float uRadii[8];
uniform int uCount;

vec2 cover(vec2 uv, vec2 image) {
  float screenRatio = uSize.x / uSize.y;
  float imageRatio = image.x / image.y;
  vec2 scale = screenRatio > imageRatio ? vec2(1.0, imageRatio / screenRatio) : vec2(screenRatio / imageRatio, 1.0);
  // Slow, sub-pixel camera drift, independent of the glass geometry.
  float zoom = 1.10 + 0.015 * sin(uTime * 0.055) * uMotion;
  vec2 camera = vec2(-uBackgroundOffset.x, uBackgroundOffset.y) / uSize * uMotion;
  return (uv - 0.5 + camera) * scale / zoom + 0.5 + vec2(sin(uTime * 0.024), cos(uTime * 0.02)) * 0.006 * uMotion;
}
vec3 scene(vec2 uv) {
  vec3 photo = mix(texture2D(uPhotoA, cover(uv, uImageA)).rgb, texture2D(uPhotoB, cover(uv, uImageB)).rgb, uMix);
  float t = uTime * 0.14;
  float wave = 0.55 + 0.19 * sin(uv.x * 4.4 + t) + 0.105 * sin(uv.x * 8.0 - t * 0.7);
  float ribbon = exp(-pow((uv.y - wave) * 2.7, 2.0));
  float curtain = 0.58 + 0.25 * sin(uv.x * 10.0 + uv.y * 2.0 + t) + 0.12 * sin(uv.x * 23.0 - t * 0.4);
  float upper = exp(-pow((uv.y - (0.85 + 0.15 * sin(uv.x * 3.0 - t))) * 2.8, 2.0));
  float colorFlow = 0.5 + 0.5 * sin(uv.x * 6.0 + uv.y * 2.2 - t * 0.85);
  vec3 aurora = mix(uColorA, uColorB, smoothstep(0.05, 0.95, colorFlow));
  vec3 opposite = mix(uColorB, uColorA, smoothstep(0.05, 0.95, colorFlow));
  float vignette = 1.0 - 0.44 * smoothstep(0.25, 0.8, length((uv - 0.5) * vec2(1.0, 0.85)));
  return (photo * 0.27 + aurora * (0.022 + ribbon * curtain * 0.14) + opposite * upper * 0.06 + vec3(0.009, 0.013, 0.022)) * vignette;
}
float roundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}
void main() {
  vec2 pixel = uView.xy + vec2(vUv.x, 1.0 - vUv.y) * uView.zw;
  vec2 sceneUv = vec2(pixel.x / uSize.x, 1.0 - pixel.y / uSize.y);
  vec3 color = scene(sceneUv);
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    vec4 rect = uPanels[i];
    vec2 halfSize = rect.zw * 0.5;
    vec2 p = pixel - rect.xy - halfSize;
    float radius = min(uRadii[i], min(halfSize.x, halfSize.y));
    float distance = roundedBox(p, halfSize, radius);
    if (distance < 1.0) {
      // Analytic normal of the bevel, with a broad curved face in the interior.
      vec2 corner = max(abs(p) - halfSize + radius, 0.0);
      vec2 normal = length(corner) > 0.001 ? normalize(corner) * sign(p)
        : (abs(p.x) - halfSize.x > abs(p.y) - halfSize.y ? vec2(sign(p.x),0.0) : vec2(0.0,sign(p.y)));
      float thickness = min(23.0, min(halfSize.x, halfSize.y) * 0.48);
      float bevel = 1.0 - smoothstep(0.0, thickness, -distance);
      vec2 face = p / max(halfSize, vec2(1.0));
      vec2 offset = (normal * pow(bevel, 1.7) * 19.0 + face * 2.8) / uSize;
      offset.y *= -1.0;
      vec2 refracted = sceneUv - offset;
      // RGB separation follows the curvature; the center remains clear.
      vec3 glass = vec3(scene(refracted - offset * 0.075).r, scene(refracted).g, scene(refracted + offset * 0.075).b);
      vec2 soft = vec2(1.2) / uSize;
      glass = glass * 0.74 + (scene(refracted + soft) + scene(refracted - soft)) * 0.13;
      glass = glass * 1.16 + mix(uColorA, uColorB, 0.18) * 0.025;
      // Fresnel edge, a directional key light and a broad, moving reflection.
      float rim = exp(-abs(distance + 1.15) * 0.72);
      float innerRim = exp(-abs(distance + 5.0) * 0.8) * 0.16;
      vec2 lightDirection = normalize(vec2(-0.65, -0.85) + uPointer * 0.18);
      float facing = pow(max(dot(normal, lightDirection), 0.0), 3.0);
      float opposite = pow(max(dot(normal, -lightDirection), 0.0), 5.0);
      glass += rim * (0.11 + facing * 0.6 + opposite * 0.23) * mix(uColorA, uColorB, smoothstep(-0.8, 0.8, face.x + face.y * 0.4));
      glass += innerRim * mix(uColorA,uColorB,0.6);
      float reflection = pow(max(0.0, 1.0 - abs(face.y + 0.73 + face.x * 0.18) * 3.0), 3.0);
      glass += reflection * (0.022 + facing * bevel * 0.095) * mix(uColorA,uColorB,smoothstep(-0.8,0.8,face.x));
      glass -= pow(bevel, 2.0) * (1.0 - facing) * 0.025;
      color = mix(color, glass, 1.0 - smoothstep(-0.5, 1.0, distance));
    }
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

export function createGlassRenderer(canvas: HTMLCanvasElement, onFailure: () => void) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!; shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('glass_shader_compile');
    return shader;
  };
  const program = gl.createProgram()!;
  const buffer = gl.createBuffer();
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('glass_shader_link');
  } catch {
    shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = Object.fromEntries(['uPhotoA','uPhotoB','uSize','uView','uImageA','uImageB','uTime','uMix','uMotion','uColorA','uColorB','uPointer','uBackgroundOffset','uPanels','uRadii','uCount'].map(key => [key, uniform(key === 'uPanels' || key === 'uRadii' ? `${key}[0]` : key)]));
  const texture = () => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15,21,32,255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  };
  let front = texture(); let back = texture();
  let frontSize = [1,1]; let backSize = [1,1];
  let hasPhoto = false; let blendElapsed = 0; let blending = false; let invalidated = false;
  let pendingPhoto: HTMLImageElement | null = null;
  let theme = themeById('violet'); let disposed = false; let raf = 0;
  let lastFrame = 0; let elapsed = 0; let needsDraw = true;
  let panelElements: HTMLElement[] = []; let panelDirty = true;
  const searchLenses = new Map<HTMLElement, { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }>();
  let pointer = [0,0];
  let backgroundOffset = [0,0];
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = media.matches;
  const upload = (tex: WebGLTexture, image: HTMLImageElement) => {
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Soften the photograph once; refraction and edge highlights stay sharp.
    const softened = document.createElement('canvas');
    softened.width = image.naturalWidth; softened.height = image.naturalHeight;
    const context = softened.getContext('2d');
    if (context) { context.filter = 'blur(2.5px)'; context.drawImage(image,-6,-6,softened.width + 12,softened.height + 12); }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, context ? softened : image);
  };
  const selector = '.search-box, .results-section:not(.search-results-panel), .settings-card, .history-list:not(:has(.empty-state)), .settings-fab, .modal, .sheet';
  const observer = new MutationObserver(() => { panelDirty = true; needsDraw = true; });
  observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
  const resize = () => { panelDirty = true; needsDraw = true; schedule(); };
  const move = (event: PointerEvent) => { pointer = [event.clientX / innerWidth * 2 - 1, event.clientY / innerHeight * 2 - 1]; if (!reduced) needsDraw = true; };
  const motion = () => { reduced = media.matches; needsDraw = true; schedule(); };
  const visibility = () => { lastFrame = 0; if (document.hidden) cancelAnimationFrame(raf); else { needsDraw = true; schedule(); } };
  const lost = (event: Event) => { event.preventDefault(); invalidated = true; cancelAnimationFrame(raf); onFailure(); };
  canvas.addEventListener('webglcontextlost', lost);
  window.addEventListener('resize', resize); window.addEventListener('scroll', resize, { passive: true, capture: true });
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion);
  // Repaint static reduced-motion scenes for layout/image changes without a hot RAF.
  const redraw = window.setInterval(() => { if (reduced && needsDraw) schedule(); }, 150);
  function schedule() { if (!disposed && !document.hidden) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } }
  function draw(now: number) {
    if (disposed || document.hidden || gl!.isContextLost()) return;
    if (!reduced && lastFrame && now - lastFrame < 1000 / 30) { raf = requestAnimationFrame(draw); return; }
    const delta = lastFrame ? Math.min(now - lastFrame, 100) : 0;
    if (!reduced) elapsed += delta;
    if (blending) blendElapsed += delta;
    lastFrame = now;
    // Limit fill cost on high-DPI mobile screens and large desktop monitors.
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2200000 / (innerWidth * innerHeight)));
    const width = Math.round(innerWidth * ratio); const height = Math.round(innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl!.viewport(0,0,width,height);
    if (panelDirty) { panelElements = document.querySelector('.game-deck') ? [] : [...document.querySelectorAll<HTMLElement>(selector)].filter(el => getComputedStyle(el).visibility !== 'hidden'); panelDirty = false; }
    for (const [element, lens] of searchLenses) {
      if (!panelElements.includes(element)) { lens.canvas.remove(); searchLenses.delete(element); }
    }
    for (const element of panelElements.filter(element => element.matches('.search-box'))) {
      if (searchLenses.has(element)) continue;
      const surface = document.createElement('canvas');
      const context = surface.getContext('2d');
      if (!context) continue;
      surface.className = 'search-glass-surface';
      surface.setAttribute('aria-hidden', 'true');
      element.insertBefore(surface, element.firstChild);
      searchLenses.set(element, { canvas: surface, context });
    }
    const rects = new Float32Array(32); const radii = new Float32Array(8); let count = 0;
    // Dialogs are listed last in DOM order and therefore cover underlying lenses.
    const visible = panelElements.filter(el => { if (!el.isConnected || searchLenses.has(el) || el.matches('.search-results-panel')) return false; const r = el.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight; }).slice(-8);
    for (const element of visible) {
      const rect = element.getBoundingClientRect();
      rects.set([rect.left,rect.top,rect.width,rect.height], count * 4);
      radii[count++] = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
    }
    let mix = blending ? Math.min(1,blendElapsed / 2400) : 0;
    if (reduced && blending) mix = 1;
    if (mix >= 1) {
      [front,back] = [back,front]; [frontSize,backSize] = [backSize,frontSize]; blending = false; mix = 0;
      if (pendingPhoto) { upload(back,pendingPhoto); backSize = [pendingPhoto.naturalWidth,pendingPhoto.naturalHeight]; pendingPhoto = null; blendElapsed = 0; blending = true; }
    }
    gl!.activeTexture(gl!.TEXTURE0); gl!.bindTexture(gl!.TEXTURE_2D,front);
    gl!.activeTexture(gl!.TEXTURE1); gl!.bindTexture(gl!.TEXTURE_2D,back);
    gl!.uniform1i(uniforms.uPhotoA,0); gl!.uniform1i(uniforms.uPhotoB,1);
    gl!.uniform2f(uniforms.uSize,innerWidth,innerHeight);
    gl!.uniform2fv(uniforms.uImageA,frontSize); gl!.uniform2fv(uniforms.uImageB,backSize);
    gl!.uniform1f(uniforms.uMix,mix * mix * (3 - 2 * mix));
    gl!.uniform1f(uniforms.uTime,elapsed / 1000); gl!.uniform1f(uniforms.uMotion,reduced ? 0 : 1);
    gl!.uniform3fv(uniforms.uColorA,theme.rgb.map(value => value / 255)); gl!.uniform3fv(uniforms.uColorB,theme.secondaryRgb.map(value => value / 255));
    gl!.uniform2fv(uniforms.uPointer,reduced ? [0,0] : pointer);
    gl!.uniform2fv(uniforms.uBackgroundOffset,reduced ? [0,0] : backgroundOffset);
    // Copy each lens onto its own DOM surface. The browser then scrolls its
    // pixels and the form's border together, even between WebGL frames.
    for (const [element, lens] of searchLenses) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) continue;
      const lensWidth = Math.min(width, Math.max(1, Math.round(rect.width * ratio)));
      const lensHeight = Math.min(height, Math.max(1, Math.round(rect.height * ratio)));
      if (lens.canvas.width !== lensWidth || lens.canvas.height !== lensHeight) {
        lens.canvas.width = lensWidth; lens.canvas.height = lensHeight;
      }
      gl!.viewport(0,0,lensWidth,lensHeight);
      gl!.uniform4f(uniforms.uView,rect.left,rect.top,rect.width,rect.height);
      gl!.uniform4fv(uniforms.uPanels,new Float32Array([rect.left,rect.top,rect.width,rect.height]));
      gl!.uniform1fv(uniforms.uRadii,new Float32Array([parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0]));
      gl!.uniform1i(uniforms.uCount,1);
      gl!.drawArrays(gl!.TRIANGLES,0,6);
      lens.context.drawImage(canvas,0,height - lensHeight,lensWidth,lensHeight,0,0,lensWidth,lensHeight);
    }
    // Replace the temporary lens renders with the full background scene.
    gl!.viewport(0,0,width,height);
    gl!.uniform4f(uniforms.uView,0,0,innerWidth,innerHeight);
    gl!.uniform4fv(uniforms.uPanels,rects); gl!.uniform1fv(uniforms.uRadii,radii); gl!.uniform1i(uniforms.uCount,count);
    gl!.drawArrays(gl!.TRIANGLES,0,6);
    needsDraw = false;
    if (!reduced) raf = requestAnimationFrame(draw);
  }
  schedule();
  return {
    setTheme(value: string) { theme = themeById(value); needsDraw = true; schedule(); },
    setBackgroundOffset(x: number, y: number) { backgroundOffset = [x,y]; needsDraw = true; },
    setPhoto(image: HTMLImageElement, immediate = false) {
      if (disposed || gl.isContextLost()) return false;
      if (!hasPhoto || reduced || immediate) { upload(front,image); frontSize = [image.naturalWidth,image.naturalHeight]; hasPhoto = true; blending = false; pendingPhoto = null; }
      else if (blending) pendingPhoto = image;
      else { upload(back,image); backSize = [image.naturalWidth,image.naturalHeight]; blendElapsed = 0; blending = true; }
      needsDraw = true; schedule();
      return true;
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); clearInterval(redraw); observer.disconnect();
      for (const lens of searchLenses.values()) lens.canvas.remove();
      searchLenses.clear();
      window.removeEventListener('resize',resize); window.removeEventListener('scroll',resize,true); window.removeEventListener('pointermove',move);
      document.removeEventListener('visibilitychange',visibility); media.removeEventListener('change',motion); canvas.removeEventListener('webglcontextlost',lost);
      // A lost context has already released these objects; after restoration
      // their handles belong to the old generation and must not be deleted.
      if (!invalidated) { gl.deleteTexture(front); gl.deleteTexture(back); gl.deleteBuffer(buffer); shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); }
    },
  };
}
