// 문구는 index.html, 색상과 배치는 presentation.css에서 수정하세요.
document.querySelector("#intro-mount").innerHTML = /* HTML */ `
  <div class="entry-intro" aria-hidden="true">
    <div class="entry-intro-black"></div>
    <svg
      class="entry-intro-curtain"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id="introTheme"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="1000"
          y2="1000"
        >
          <stop stop-color="#f564a1" />
          <stop offset="1" stop-color="#ff9d6d" />
        </linearGradient>
        <mask
          id="introPaint"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1000"
          height="1000"
        >
          <path
            class="entry-intro-spread"
            d="M1100 -100 L1000 0 C950 75 875 65 865 135 C855 205 745 180 735 265 C725 340 635 315 605 395 C575 475 520 425 500 500 C480 575 395 550 370 630 C345 710 255 670 235 765 C215 850 115 815 100 900 C85 955 35 950 0 1000 L-100 1100"
            fill="none"
            stroke="white"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </mask>
      </defs>
      <g mask="url(#introPaint)">
        <g class="entry-intro-paint entry-intro-left">
          <path
            d="M1100 -100 L1000 0 C950 75 875 65 865 135 C855 205 745 180 735 265 C725 340 635 315 605 395 C575 475 520 425 500 500 C480 575 395 550 370 630 C345 710 255 670 235 765 C215 850 115 815 100 900 C85 955 35 950 0 1000 L-100 1100 H-1800 V-100 Z"
            fill="url(#introTheme)"
            stroke="url(#introTheme)"
            stroke-width="2"
          />
          <path
            class="entry-intro-paint-edge"
            d="M1100 -100 L1000 0 C950 75 875 65 865 135 C855 205 745 180 735 265 C725 340 635 315 605 395 C575 475 520 425 500 500 C480 575 395 550 370 630 C345 710 255 670 235 765 C215 850 115 815 100 900 C85 955 35 950 0 1000 L-100 1100"
            fill="none"
            stroke="#ff9dbe"
            stroke-width="18"
          />
        </g>
        <g class="entry-intro-paint entry-intro-right">
          <path
            d="M1100 -100 L1000 0 C950 75 875 65 865 135 C855 205 745 180 735 265 C725 340 635 315 605 395 C575 475 520 425 500 500 C480 575 395 550 370 630 C345 710 255 670 235 765 C215 850 115 815 100 900 C85 955 35 950 0 1000 L-100 1100 H2800 V-100 Z"
            fill="url(#introTheme)"
            stroke="url(#introTheme)"
            stroke-width="2"
          />
          <path
            class="entry-intro-paint-edge"
            d="M1100 -100 L1000 0 C950 75 875 65 865 135 C855 205 745 180 735 265 C725 340 635 315 605 395 C575 475 520 425 500 500 C480 575 395 550 370 630 C345 710 255 670 235 765 C215 850 115 815 100 900 C85 955 35 950 0 1000 L-100 1100"
            fill="none"
            stroke="#ff9dbe"
            stroke-width="18"
          />
        </g>
      </g>
      <path
        class="entry-intro-seam"
        d="M0 1000 L1000 0"
        fill="none"
        stroke="#f564a1"
        stroke-width="3"
        pathLength="1"
      />
    </svg>
    <svg class="entry-intro-logo" viewBox="0 0 512 512" fill="#f564a1">
      <path
        d="M72 368V144H124L186 232L248 144H440V196H300V232H412V284H300V368H248V238L186 322L124 238V368H72Z"
      />
    </svg>
  </div>
`;

/* === FIXED STAGE & PRESENTATION CONTROLLER === */
const stage = document.querySelector("#deckStage"),
  viewport = document.querySelector(".deck-viewport"),
  slides = [...document.querySelectorAll(".slide")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let current = 0,
  editing = false,
  embedded = false,
  drawArt = () => {};
try {
  embedded = self !== top;
} catch {
  embedded = true;
}
document.documentElement.classList.toggle("embed", embedded);
function scaleStage() {
  const w = document.documentElement.clientWidth || innerWidth,
    h = innerHeight,
    s = embedded ? w / 1920 : Math.min(w / 1920, h / 1080);
  viewport.style.width = 1920 * s + "px";
  viewport.style.height = 1080 * s + "px";
  stage.style.transform = `scale(${s})`;
  if (embedded)
    try {
      if (frameElement) frameElement.style.height = 1080 * s + "px";
    } catch {}
}
addEventListener("resize", scaleStage);
scaleStage();
function showSlide(index) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((s, i) => {
    s.classList.toggle("active", i === current);
    s.inert = i !== current;
    s.setAttribute("aria-hidden", String(i !== current));
  });
  stage.dataset.slide = current;
  const fallback = document.querySelector("#landscape");
  fallback.src = slides[current].dataset.background;
  document.querySelector("#announcement").textContent =
    slides[current].querySelector("h1,h2").innerText;
  history.replaceState(null, "", "#" + (current + 1));
  drawArt();
}
addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    finishIntro();
    toggleEdit(false);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveHTML();
    return;
  }
  if (e.target.isContentEditable) return;
  if (e.key.toLowerCase() === "e") {
    toggleEdit(!editing);
    return;
  }
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
    e.preventDefault();
    showSlide(current + 1);
  }
  if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
    e.preventDefault();
    showSlide(current - 1);
  }
  if (e.key === "Home") {
    e.preventDefault();
    showSlide(0);
  }
  if (e.key === "End") {
    e.preventDefault();
    showSlide(slides.length - 1);
  }
});
let wheelAt = 0;
addEventListener(
  "wheel",
  (e) => {
    if (editing || Math.abs(e.deltaY) < 15) return;
    e.preventDefault();
    if (performance.now() - wheelAt > 800) {
      wheelAt = performance.now();
      showSlide(current + Math.sign(e.deltaY));
    }
  },
  { passive: false },
);
let touch = null;
stage.addEventListener(
  "touchstart",
  (e) => {
    touch = [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
  },
  { passive: true },
);
stage.addEventListener(
  "touchend",
  (e) => {
    if (!touch || editing) return;
    const dx = e.changedTouches[0].clientX - touch[0],
      dy = e.changedTouches[0].clientY - touch[1];
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
      showSlide(current + (dx < 0 ? 1 : -1));
    touch = null;
  },
  { passive: true },
);
addEventListener("hashchange", () =>
  showSlide((Number(location.hash.slice(1)) || 1) - 1),
);
showSlide((Number(location.hash.slice(1)) || 1) - 1);
/* === 브라우저 임시 문구 편집: 파일의 문구를 덮어쓰지 않습니다. === */
const editables = [...document.querySelectorAll("[data-edit]")],
  editButton = document.querySelector(".edit-toggle"),
  hotzone = document.querySelector(".edit-hotzone");
function toggleEdit(on) {
  editing = on;
  stage.classList.toggle("editing", on);
  editables.forEach((el) => (el.contentEditable = on ? "true" : "false"));
  editButton.textContent = on ? "편집 마침" : "텍스트 편집";
  editButton.setAttribute("aria-pressed", String(on));
}
editButton.onclick = () => toggleEdit(!editing);
let hideEdit;
[hotzone, editButton].forEach((el) => {
  el.addEventListener("mouseenter", () => {
    clearTimeout(hideEdit);
    editButton.classList.add("show");
  });
  el.addEventListener("mouseleave", () => {
    hideEdit = setTimeout(() => editButton.classList.remove("show"), 400);
  });
});
function saveHTML() {
  toggleEdit(false);
  const copy = document.documentElement.cloneNode(true);
  copy.querySelector("#intro-mount").replaceChildren();
  copy
    .querySelectorAll("[contenteditable]")
    .forEach((el) => el.removeAttribute("contenteditable"));
  const url = URL.createObjectURL(
      new Blob(["<!doctype html>\n" + copy.outerHTML], {
        type: "text/html;charset=utf-8",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "index.html";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/* === ORIGINAL INTRO, FIRST SLIDE ONLY === */
const intro = document.querySelector(".entry-intro");
intro.hidden = false;
let introTimer;
function finishIntro() {
  clearTimeout(introTimer);
  intro.hidden = true;
  stage.classList.remove("intro-playing");
  slides.forEach((s, i) => (s.inert = i !== current));
  editButton.inert = false;
}
if (current === 0 && !reduced.matches) {
  stage.classList.add("intro-playing");
  slides.forEach((s) => (s.inert = true));
  editButton.inert = true;
  intro.addEventListener("animationend", (e) => {
    if (e.animationName === "entry-intro-dismiss") finishIntro();
  });
  introTimer = setTimeout(finishIntro, 3800);
} else finishIntro();
reduced.addEventListener("change", () => {
  if (reduced.matches) finishIntro();
});
addEventListener("keydown", (e) => {
  if (
    stage.classList.contains("intro-playing") &&
    [
      "ArrowRight",
      "ArrowLeft",
      "ArrowUp",
      "ArrowDown",
      "PageDown",
      "PageUp",
      " ",
      "Home",
      "End",
    ].includes(e.key)
  )
    finishIntro();
});
