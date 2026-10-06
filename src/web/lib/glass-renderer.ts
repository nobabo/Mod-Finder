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
uniform sampler2D uScene;
uniform int uUseScene;
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
  if (uUseScene == 1) return texture2D(uScene, uv).rgb;
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
  const uniforms = Object.fromEntries(['uPhotoA','uPhotoB','uScene','uUseScene','uSize','uView','uImageA','uImageB','uTime','uMix','uMotion','uColorA','uColorB','uPointer','uBackgroundOffset','uPanels','uRadii','uCount'].map(key => [key, uniform(key === 'uPanels' || key === 'uRadii' ? `${key}[0]` : key)]));
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
  const sceneTexture = texture();
  const sceneTarget = gl.createFramebuffer();
  let sceneWidth = 0; let sceneHeight = 0; let sceneCache = !!sceneTarget; let sceneDirty = true;
  let frontSize = [1,1]; let backSize = [1,1];
  let hasPhoto = false; let blendElapsed = 0; let blending = false; let invalidated = false;
  let pendingPhoto: HTMLImageElement | null = null;
  let theme = themeById('violet'); let disposed = false; let raf = 0;
  let lastSceneFrame = 0; let elapsed = 0;
  let paused = false;
  let panelElements: HTMLElement[] = []; let panelDirty = true; let geometryDirty = true;
  const geometry = new Map<HTMLElement, { rect: DOMRect; radius: number }>();
  const observed = new Set<HTMLElement>();
  const rects = new Float32Array(32); const radii = new Float32Array(8);
  const lensRect = new Float32Array(4); const lensRadius = new Float32Array(1);
  const controlLenses = new Map<HTMLElement, { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }>();
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
  const controlSelector = '.search-box, .filter-orb, .mobile-header .settings-fab, .mobile-nav-glass, .deck-search, .filter-dropdown.is-liquid-glass, .filter-dropdown-search, .ranking-panel, .folder-modal, .folder-input-glass';
  const selector = `${controlSelector}, .results-section:not(.search-results-panel), .settings-card, .history-list:not(:has(.empty-state)):not(.collection-stage .history-list), .settings-fab, .modal, .sheet`;
  const observer = new MutationObserver(() => { panelDirty = true; schedule(); });
  observer.observe(document.body, { childList: true, subtree: true });
  const resize = () => { panelDirty = true; schedule(); };
  // Scrolling changes positions, not the set of panels or their corner styles.
  // Present geometry at display cadence independently of the 30 Hz scene clock.
  const scroll = () => { geometryDirty = true; schedule(); };
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas);
  document.addEventListener('transitionend', resize, true);
  document.addEventListener('animationend', resize, true);
  const move = (event: PointerEvent) => { if (paused || event.pointerType !== 'mouse') return; pointer = [event.clientX / innerWidth * 2 - 1, event.clientY / innerHeight * 2 - 1];  };
  const motion = () => { reduced = media.matches; sceneDirty = true; lastSceneFrame = 0; schedule(); };
  const visibility = () => { lastSceneFrame = 0; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { geometryDirty = true; schedule(); } };
  const lost = (event: Event) => { event.preventDefault(); invalidated = true; cancelAnimationFrame(raf); raf = 0; onFailure(); };
  canvas.addEventListener('webglcontextlost', lost);
  window.addEventListener('resize', resize); window.addEventListener('scroll', scroll, { passive: true, capture: true });
  window.visualViewport?.addEventListener('resize', scroll); window.visualViewport?.addEventListener('scroll', scroll);
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('visibilitychange', visibility); media.addEventListener('change', motion);
  // Paused scenes redraw only for changed layout/content, keeping new dialogs legible.
  function schedule() { if (!disposed && !invalidated && !document.hidden && !raf) raf = requestAnimationFrame(draw); }
  function draw(now: number) {
    raf = 0;
    if (disposed || document.hidden || gl!.isContextLost()) return;
    const sceneDue = !paused && !reduced && (!lastSceneFrame || now - lastSceneFrame >= 1000 / 30);
    if (!panelDirty && !geometryDirty && !sceneDirty && !sceneDue) {
      if (!paused && !reduced) schedule();
      return;
    }
    // CSS fixes the touch backdrop to the large viewport. innerHeight changes
    // as browser chrome retracts and must not resize/re-crop this texture.
    const viewWidth = Math.max(1, canvas.clientWidth); const viewHeight = Math.max(1, canvas.clientHeight);
    // Limit fill cost on high-DPI mobile screens and large desktop monitors.
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2200000 / (viewWidth * viewHeight)));
    const width = Math.round(viewWidth * ratio); const height = Math.round(viewHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; sceneDirty = true; geometryDirty = true; }
    const updateScene = sceneDirty || sceneDue;
    if (updateScene) {
      const delta = !paused && !reduced && lastSceneFrame ? Math.min(now - lastSceneFrame, 100) : 0;
      elapsed += delta;
      if (blending) blendElapsed += delta;
      lastSceneFrame = now;
      sceneDirty = false;
    }
    gl!.viewport(0,0,width,height);
    if (panelDirty) {
      const deck = document.querySelector('.game-deck');
      panelElements = [...(deck ?? document).querySelectorAll<HTMLElement>(deck ? controlSelector : selector)].filter(el => getComputedStyle(el).visibility !== 'hidden');
      for (const element of observed) if (!panelElements.includes(element)) { sizes.unobserve(element); observed.delete(element); }
      geometry.clear();
      for (const element of panelElements) {
        if (!observed.has(element)) { sizes.observe(element); observed.add(element); }
        geometry.set(element, { rect: element.getBoundingClientRect(), radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0 });
      }
      panelDirty = false;
      geometryDirty = false;
    } else if (geometryDirty) {
      for (const element of panelElements) geometry.get(element)!.rect = element.getBoundingClientRect();
      geometryDirty = false;
    }
    for (const [element, lens] of controlLenses) {
      if (!panelElements.includes(element)) { lens.canvas.remove(); controlLenses.delete(element); }
    }
    for (const element of panelElements.filter(element => element.matches(controlSelector))) {
      if (controlLenses.has(element)) continue;
      const surface = document.createElement('canvas');
      const context = surface.getContext('2d');
      if (!context) continue;
      surface.className = 'glass-control-surface';
      surface.setAttribute('aria-hidden', 'true');
      element.insertBefore(surface, element.firstChild);
      controlLenses.set(element, { canvas: surface, context });
    }
    rects.fill(0); radii.fill(0); let count = 0;
    // Dialogs are listed last in DOM order and therefore cover underlying lenses.
    const visible = panelElements.filter(el => { if (!el.isConnected || controlLenses.has(el) || el.matches('.search-results-panel')) return false; const r = geometry.get(el)!.rect; return r.width && r.height && r.bottom > 0 && r.top < innerHeight; }).slice(-8);
    for (const element of visible) {
      const { rect, radius } = geometry.get(element)!;
      rects.set([rect.left,rect.top,rect.width,rect.height], count * 4);
      radii[count++] = radius;
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
    gl!.uniform2f(uniforms.uSize,viewWidth,viewHeight);
    gl!.uniform2fv(uniforms.uImageA,frontSize); gl!.uniform2fv(uniforms.uImageB,backSize);
    gl!.uniform1f(uniforms.uMix,mix * mix * (3 - 2 * mix));
    gl!.uniform1f(uniforms.uTime,elapsed / 1000); gl!.uniform1f(uniforms.uMotion,reduced ? 0 : 1);
    gl!.uniform3fv(uniforms.uColorA,theme.rgb.map(value => value / 255)); gl!.uniform3fv(uniforms.uColorB,theme.secondaryRgb.map(value => value / 255));
    gl!.uniform2fv(uniforms.uPointer,reduced ? [0,0] : pointer);
    gl!.uniform2fv(uniforms.uBackgroundOffset,reduced ? [0,0] : backgroundOffset);
    // Calculate the photographic/aurora scene once per frame. Refraction samples
    // this texture instead of repeating its trigonometry for every RGB/blur tap.
    gl!.uniform1i(uniforms.uScene,2); gl!.uniform1i(uniforms.uUseScene,0);
    gl!.activeTexture(gl!.TEXTURE2);
    if (sceneCache && updateScene) {
      gl!.bindTexture(gl!.TEXTURE_2D,sceneTexture);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER,sceneTarget);
      if (sceneWidth !== width || sceneHeight !== height) {
        gl!.texImage2D(gl!.TEXTURE_2D,0,gl!.RGBA,width,height,0,gl!.RGBA,gl!.UNSIGNED_BYTE,null);
        gl!.framebufferTexture2D(gl!.FRAMEBUFFER,gl!.COLOR_ATTACHMENT0,gl!.TEXTURE_2D,sceneTexture,0);
        sceneCache = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
        sceneWidth = width; sceneHeight = height;
      }
      // Never sample a texture while it is attached to the active render target.
      gl!.bindTexture(gl!.TEXTURE_2D,front);
      if (sceneCache) {
        gl!.uniform4f(uniforms.uView,0,0,viewWidth,viewHeight);
        gl!.uniform1i(uniforms.uCount,0);
        gl!.drawArrays(gl!.TRIANGLES,0,6);
      }
      gl!.bindFramebuffer(gl!.FRAMEBUFFER,null);
    }
    gl!.bindTexture(gl!.TEXTURE_2D,sceneCache ? sceneTexture : front);
    gl!.uniform1i(uniforms.uUseScene,sceneCache ? 1 : 0);
    // Copy each lens onto its own DOM surface. The browser then scrolls its
    // pixels and the control's border together, even between WebGL frames.
    for (const [element, lens] of controlLenses) {
      const { rect, radius } = geometry.get(element)!;
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) continue;
      const lensWidth = Math.min(width, Math.max(1, Math.round(rect.width * ratio)));
      const lensHeight = Math.min(height, Math.max(1, Math.round(rect.height * ratio)));
      if (lens.canvas.width !== lensWidth || lens.canvas.height !== lensHeight) {
        lens.canvas.width = lensWidth; lens.canvas.height = lensHeight;
      }
      gl!.viewport(0,0,lensWidth,lensHeight);
      gl!.uniform4f(uniforms.uView,rect.left,rect.top,rect.width,rect.height);
      lensRect.set([rect.left,rect.top,rect.width,rect.height]); lensRadius[0] = radius;
      gl!.uniform4fv(uniforms.uPanels,lensRect);
      gl!.uniform1fv(uniforms.uRadii,lensRadius);
      gl!.uniform1i(uniforms.uCount,1);
      gl!.drawArrays(gl!.TRIANGLES,0,6);
      lens.context.drawImage(canvas,0,height - lensHeight,lensWidth,lensHeight,0,0,lensWidth,lensHeight);
    }
    // Replace the temporary lens renders with the full background scene.
    gl!.viewport(0,0,width,height);
    gl!.uniform4f(uniforms.uView,0,0,viewWidth,viewHeight);
    gl!.uniform4fv(uniforms.uPanels,rects); gl!.uniform1fv(uniforms.uRadii,radii); gl!.uniform1i(uniforms.uCount,count);
    gl!.drawArrays(gl!.TRIANGLES,0,6);

    if (!paused && !reduced) schedule();
  }
  schedule();
  return {
    setPaused(value: boolean) { if (paused === value) return; paused = value; lastSceneFrame = 0; geometryDirty = true; schedule(); },
    setTheme(value: string) { theme = themeById(value); sceneDirty = true; schedule(); },
    setBackgroundOffset(x: number, y: number) { if (backgroundOffset[0] === x && backgroundOffset[1] === y) return; backgroundOffset = [x,y]; sceneDirty = true; schedule(); },
    setPhoto(image: HTMLImageElement, immediate = false) {
      if (disposed || gl.isContextLost()) return false;
      if (!hasPhoto || reduced || immediate) { upload(front,image); frontSize = [image.naturalWidth,image.naturalHeight]; hasPhoto = true; blending = false; pendingPhoto = null; }
      else if (blending) pendingPhoto = image;
      else { upload(back,image); backSize = [image.naturalWidth,image.naturalHeight]; blendElapsed = 0; blending = true; }
      sceneDirty = true; schedule();
      return true;
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); sizes.disconnect();
      document.removeEventListener('transitionend',resize,true); document.removeEventListener('animationend',resize,true);
      for (const lens of controlLenses.values()) lens.canvas.remove();
      controlLenses.clear();
      window.removeEventListener('resize',resize); window.removeEventListener('scroll',scroll,true); window.removeEventListener('pointermove',move);
      window.visualViewport?.removeEventListener('resize',scroll); window.visualViewport?.removeEventListener('scroll',scroll);
      document.removeEventListener('visibilitychange',visibility); media.removeEventListener('change',motion); canvas.removeEventListener('webglcontextlost',lost);
      // A lost context has already released these objects; after restoration
      // their handles belong to the old generation and must not be deleted.
      if (!invalidated) { gl.deleteTexture(front); gl.deleteTexture(back); gl.deleteTexture(sceneTexture); gl.deleteFramebuffer(sceneTarget); gl.deleteBuffer(buffer); shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); }
    },
  };
}
