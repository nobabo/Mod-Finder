
/* 게임별 WebGL 장면. 스티브의 점은 윤곽에 고정하고 주니모는 원본 픽셀을 유지합니다. */
const artCanvas = document.querySelector("#game-art");
const slideArt = {
  "story-1": "steve",
  "story-2": "junimo",
  "story-13": "rimworld",
};
let artReady = false,
  artFrame = 0;
function initArt() {
  const gl = artCanvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!gl) return;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error("Game shader");
    return s;
  };
  try {
    const program = gl.createProgram();
    gl.attachShader(
      program,
      shader(
        gl.VERTEX_SHADER,
        "attribute vec2 aPosition;attribute vec4 aColor;varying vec4 vColor;void main(){gl_Position=vec4(aPosition.x/960.-1.,1.-aPosition.y/540.,0.,1.);vColor=aColor;}",
      ),
    );
    gl.attachShader(
      program,
      shader(
        gl.FRAGMENT_SHADER,
        "precision mediump float;varying vec4 vColor;void main(){gl_FragColor=vColor;}",
      ),
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error("Game program");
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const position = gl.getAttribLocation(program, "aPosition"),
      color = gl.getAttribLocation(program, "aColor");
    gl.enableVertexAttribArray(position);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    let vertices = [],
      elapsed = 0,
      last = 0,
      pointer = [0, 0];
    // 28초마다 처음 색으로 자연스럽게 돌아오는 네온 팔레트.
    const palette = [
      [245, 100, 161],
      [255, 157, 109],
      [182, 119, 255],
      [255, 112, 192],
    ];
    const rgba = (hex, alpha = 1) => [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
      alpha,
    ];
    const triangle = (a, b, c, tint) => {
      for (const p of [a, b, c]) vertices.push(...p, ...tint);
    };

    // 분리된 네온 점을 그리는 도우미.
    function neonDot(x, y, strength = 1, size = 1.6) {
      const blend = Math.max(
        0,
        Math.min(1, ((x - 1270) / 440) * 0.3 + ((y - 140) / 650) * 0.7),
      );
      const phase =
        (reduced.matches || stage.dataset.art !== "steve" ? 0 : elapsed / 7) + blend;
      const index = Math.floor(phase) % palette.length;
      const fraction = phase % 1;
      const mix = fraction * fraction * (3 - 2 * fraction);
      const rgb = palette[index].map(
        (channel, i) =>
          (channel +
            (palette[(index + 1) % palette.length][i] - channel) * mix) /
          255,
      );
      const themeColor = (alpha) => [...rgb, alpha];
      const disc = (r, c) => {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3,
            b = ((i + 1) * Math.PI) / 3;
          triangle(
            [x, y],
            [x + Math.cos(a) * r, y + Math.sin(a) * r],
            [x + Math.cos(b) * r, y + Math.sin(b) * r],
            c,
          );
        }
      };
      disc(size * 3.8, themeColor(0.028 * strength));
      disc(size * 1.6, themeColor(0.12 * strength));
      disc(size, themeColor(0.85 * strength));
      disc(size * 0.43, rgba("#ffe5f2", 0.88 * strength));
    }
    function dottedPath(points, strength, count, size) {
      const [a, b] = points;
      for (let i = 0; i < count; i++) {
        const f = i / count;
        // 시간에 따른 개별 점의 위치·크기 변화 없이 윤곽을 일정하게 유지합니다.
        neonDot(
          a[0] + (b[0] - a[0]) * f,
          a[1] + (b[1] - a[1]) * f,
          strength,
          size,
        );
      }
    }
    /* === STATIC GAME SYMBOLS ===
       게임을 알아볼 수 있는 특징만 점 윤곽으로 표현한 장식입니다.
       실제 제품 화면은 HTML의 원본 스크린샷을 그대로 사용합니다. */
    function symbolPen(cx, cy, scale) {
      const project = ([x, y]) => [cx + x * scale, cy + y * scale];
      const path = (points, strength = 0.94, size = 2) => {
        for (let i = 1; i < points.length; i++) {
          const a = project(points[i - 1]), b = project(points[i]);
          dottedPath([a, b], strength,
            Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9)), size);
        }
      };
      const oval = (x, y, rx, ry, strength = 0.94, size = 2) => {
        const count = Math.max(12, Math.ceil(2 * Math.PI * Math.max(rx, ry) * scale / 9));
        for (let i = 0; i < count; i++) {
          const a = i / count * Math.PI * 2;
          const p = project([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
          neonDot(...p, strength, size);
        }
      };
      return { path, oval };
    }
    const symbols = {
      junimo() {
        // Junimo Icon.png (ConcernedApe), 원본: assets/symbols/junimo.png
        // https://stardewvalleywiki.com/File:Junimo_Icon.png
        // 원본 48×48의 동일한 3×3 블록을 16×16으로 기록했습니다.
        // 실제 색과 픽셀 배치를 그대로 그려 file://에서도 외부 요청 없이 표시합니다.
        const colors = [null, "#47cb1b", "#043d0f", "#8df033", "#32861c", "#a5b583"];
        const pixels = [
          "0000000000000000",
          "0000000010000000",
          "0020000020000200",
          "0200022222200020",
          "0200233123320020",
          "0202314224132020",
          "0224314444134220",
          "0024133333314200",
          "0021111111111200",
          "0021111111111200",
          "0021121111211200",
          "0021131111311200",
          "0024551141554200",
          "0002411111142000",
          "0000222222220000",
          "0002200000022000",
        ];
        const cell = 30, left = 1260, top = 300;
        pixels.forEach((row, y) => {
          [...row].forEach((value, x) => {
            if (value === "0") return;
            const tint = rgba(colors[Number(value)]);
            const x0 = left + x * cell, y0 = top + y * cell;
            const a = [x0, y0], b = [x0 + cell, y0];
            const c = [x0 + cell, y0 + cell], d = [x0, y0 + cell];
            triangle(a, b, c, tint);
            triangle(a, c, d, tint);
          });
        });
      },
      rimworld() {
        const { path, oval } = symbolPen(1570, 490, 188);
        // 림월드의 원형 문장과 끝이 둥근 다섯 갈래 별.
        oval(0, 0, 1.13, 1.13, 0.35, 1.7);
        oval(0, 0, 1.01, 1.01, 0.98, 2.3);
        const star = [];
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 5;
          const r = i % 2 ? 0.4 : 0.74;
          star.push([Math.cos(angle) * r, Math.sin(angle) * r]);
          if (i % 2 === 0) oval(Math.cos(angle) * r, Math.sin(angle) * r, 0.07, 0.07, 1, 2.1);
        }
        path([...star, star[0]], 1, 2.4);
        path([...star, star[0]].map(([x, y]) => [x * 0.82, y * 0.82]), 0.25, 1.6);
      },
    };
    function steve(t) {
      // Camera elevated 52 degrees; limbs pivot at shoulders and hips.
      // A slow 3.8-second walking cycle stays within the title composition.
      const yaw = -0.58 + pointer[0] * 0.065,
        pitch = 0.91,
        c = Math.cos(yaw),
        s = Math.sin(yaw);
      const phase = t * 1.65,
        stride = Math.sin(phase) * 0.4,
        bob = (1 - Math.cos(phase * 2)) * 0.15;
      const project = ([x, y, z]) => {
        y += bob;
        const xx = x * c + z * s,
          zz = z * c - x * s,
          yy = (y - 16) * Math.cos(pitch) - zz * Math.sin(pitch),
          depth = zz * Math.cos(pitch) + (y - 16) * Math.sin(pitch),
          perspective = 1 + depth * 0.006;
        return [1470 + xx * 25 * perspective, 510 - yy * 25 * perspective];
      };
      function cube(x, y, z, w, h, d, angle = 0, pivot = y) {
        const pts = [];
        for (const dy of [-1, 1])
          for (const dz of [-1, 1])
            for (const dx of [-1, 1]) {
              const py = y + (dy * h) / 2 - pivot,
                pz = (dz * d) / 2;
              pts.push([
                x + (dx * w) / 2,
                pivot + py * Math.cos(angle) - pz * Math.sin(angle),
                z + py * Math.sin(angle) + pz * Math.cos(angle),
              ]);
            }
        const edges = [
          [0, 1],
          [2, 3],
          [4, 5],
          [6, 7],
          [0, 2],
          [1, 3],
          [4, 6],
          [5, 7],
          [0, 4],
          [1, 5],
          [2, 6],
          [3, 7],
        ];
        for (const [a, b] of edges) {
          const back = (pts[a][2] + pts[b][2]) / 2 < z;
          dottedPath(
            [project(pts[a]), project(pts[b])],
            back ? 0.22 : 0.94,
            Math.max(
              2,
              Math.round(
                (Math.hypot(...pts[a].map((v, i) => v - pts[b][i])) * 25) / 11,
              ),
            ),
            1.85,
          );
        }
      }
      cube(-2.15, 6, 0, 3.8, 12, 4, stride, 12);
      cube(2.15, 6, 0, 3.8, 12, 4, -stride, 12);
      cube(0, 18, 0, 8, 12, 4);
      cube(-6, 18, 0, 4, 12, 4, -stride * 0.8, 24);
      cube(6, 18, 0, 4, 12, 4, stride * 0.8, 24);
      cube(0, 28, 0, 8, 8, 8);
    }
    function resize() {
      artCanvas.width = Math.round(
        Math.min(
          1920,
          Math.max(
            640,
            viewport.clientWidth * Math.min(devicePixelRatio || 1, 1.5),
          ),
        ),
      );
      artCanvas.height = Math.round((artCanvas.width * 9) / 16);
      gl.viewport(0, 0, artCanvas.width, artCanvas.height);
      drawArt();
    }
    function render(now = performance.now()) {
      artFrame = 0;
      const art = slideArt[slides[current].getAttribute("aria-labelledby")] || "";
      stage.dataset.art = art;
      if (!artReady || document.hidden) {
        last = 0;
        return;
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!art) {
        last = 0;
        return;
      }
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = art === "steve" ? now : 0;
      if (!reduced.matches && art === "steve") elapsed += delta;
      vertices = [];
      if (art === "steve") steve(reduced.matches ? 0 : elapsed);
      else symbols[art]();
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.DYNAMIC_DRAW,
      );
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
      if (!reduced.matches && art === "steve") artFrame = requestAnimationFrame(render);
    }
    drawArt = () => {
      cancelAnimationFrame(artFrame);
      render();
    };
    artReady = true;
    resize();
    addEventListener("resize", resize);
    reduced.addEventListener("change", drawArt);
    stage.addEventListener("pointermove", (e) => {
      if (reduced.matches) return;
      const r = stage.getBoundingClientRect();
      pointer = [
        (e.clientX - r.left) / r.width - 0.5,
        (e.clientY - r.top) / r.height - 0.5,
      ];
    });
    document.addEventListener("visibilitychange", () => {
      last = 0;
      if (document.hidden) cancelAnimationFrame(artFrame);
      else drawArt();
    });
  } catch {
    artReady = false;
  }
}
artCanvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  cancelAnimationFrame(artFrame);
  artReady = false;
  artCanvas.style.opacity = "0";
});
artCanvas.addEventListener("webglcontextrestored", () => location.reload());
initArt();

