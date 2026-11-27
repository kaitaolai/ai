(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // colour theme: system -> light -> dark, stored under the same key as the academic site
  const root = document.documentElement;
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const themeBtn = document.getElementById('themeBtn');
  function applyTheme(animate) {
    let p = 'system';
    try { p = localStorage.getItem('theme') || 'system'; } catch (e) {}
    if (p !== 'light' && p !== 'dark') p = 'system';
    const t = p === 'dark' || (p === 'system' && dark.matches) ? 'dark' : 'light';
    if (animate && !reduce) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 400); }
    root.setAttribute('data-pref', p);
    root.setAttribute('data-theme', t);
    if (themeBtn) { const l = 'Colour theme: ' + p; themeBtn.setAttribute('aria-label', l); themeBtn.title = l; }
    document.dispatchEvent(new Event('themechange'));
  }
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const cur = root.getAttribute('data-pref') || 'system';
    const next = cur === 'system' ? 'light' : cur === 'light' ? 'dark' : 'system';
    try { localStorage.setItem('theme', next); } catch (e) {}
    applyTheme(true);
  });
  dark.addEventListener('change', () => applyTheme(true));
  window.addEventListener('storage', e => { if (e.key === 'theme') applyTheme(true); });
  applyTheme(false);

  // glow follows the mouse
  const spot = document.querySelector('.spotlight');
  window.addEventListener('pointermove', e => {
    spot.style.setProperty('--mx', e.clientX + 'px');
    spot.style.setProperty('--my', e.clientY + 'px');
  });

  // nav hides on scroll down, comes back on scroll up
  const nav = document.getElementById('nav');
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('shadow', y > 10);
    nav.classList.toggle('hide', y > lastY && y > 200 && !menu.classList.contains('open'));
    lastY = y;
    updateTimeline();
  }, { passive: true });

  // mobile menu
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', false);
  }));

  // reveal on scroll, with a small stagger inside card grids
  document.querySelectorAll('.cards .card').forEach((c, i) => { c.style.transitionDelay = (i % 3) * 90 + 'ms'; });
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        en.target.querySelectorAll('rect[data-w]').forEach((r, i) => {
          setTimeout(() => { r.style.width = r.dataset.w + 'px'; }, reduce ? 0 : 150 + i * 120);
          setTimeout(() => r.setAttribute('width', r.dataset.w), reduce ? 0 : 1500 + i * 120);
        });
        if (en.target.querySelector('.num') || en.target.classList.contains('num')) countUp();
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  // once revealed, drop the stagger so hover feels instant
  document.querySelectorAll('.cards .card').forEach(c => c.addEventListener('transitionend', () => { c.style.transitionDelay = '0ms'; }, { once: true }));

  // numbers count up
  let counted = false;
  function countUp() {
    if (counted) return; counted = true;
    document.querySelectorAll('.num').forEach(el => {
      const to = +el.dataset.to, plus = el.dataset.plus ? '+' : '';
      if (reduce) { el.textContent = to.toLocaleString('en') + plus; return; }
      const t0 = performance.now(), dur = 1400;
      (function step(t) {
        const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e).toLocaleString('en') + (p === 1 ? plus : '');
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  // active section in the nav
  const links = [...menu.querySelectorAll('a[href^="#"]')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => s && spy.observe(s));

  // timeline line fills as you scroll through it
  const tl = document.querySelector('.timeline');
  function updateTimeline() {
    if (!tl) return;
    const r = tl.getBoundingClientRect(), vh = window.innerHeight;
    const p = Math.max(0, Math.min(1, (vh * 0.7 - r.top) / r.height));
    tl.style.setProperty('--progress', (p * 100).toFixed(1) + '%');
  }
  updateTimeline();

  // hero: agents -> synthesis -> signal, with packets moving along the edges
  const cv = document.getElementById('graph');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const C = {};
  function readColours() {
    const css = getComputedStyle(document.documentElement);
    const v = n => css.getPropertyValue(n).trim();
    Object.assign(C, { accent: v('--accent'), line: v('--edge-box'), ink: v('--ink'), muted: v('--muted'), surface: v('--surface') });
    const h = C.accent.replace('#', '');
    C.rgb = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)).join(',');
  }
  readColours();
  document.addEventListener('themechange', readColours);
  const sources = ['Filings', 'Releases', 'News', 'Insider', 'Macro'];
  let W, H, nodes, packets = [], mouse = { x: -999, y: -999 };

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const agents = sources.map((s, i) => ({
      label: s, bx: W * 0.2, by: H * (0.14 + i * 0.18), r: 9, phase: i * 1.3
    }));
    const synth = { label: 'Synthesis', bx: W * 0.58, by: H * 0.5, r: 15, phase: 0 };
    const signal = { label: 'Signal', bx: W * 0.86, by: H * 0.5, r: 11, phase: 2 };
    nodes = { agents, synth, signal };
  }

  function pos(n, t) {
    const dx = Math.sin(t / 1600 + n.phase) * 5, dy = Math.cos(t / 1900 + n.phase) * 5;
    let x = n.bx + dx, y = n.by + dy;
    const mx = x - mouse.x, my = y - mouse.y, d = Math.hypot(mx, my);
    if (d < 90 && d > 0) { x += mx / d * (90 - d) * 0.25; y += my / d * (90 - d) * 0.25; }
    return { x, y };
  }

  function spawn(t) {
    if (Math.random() < 0.06) {
      const a = Math.floor(Math.random() * sources.length);
      packets.push({ from: a, seg: 0, p: 0, v: 0.008 + Math.random() * 0.006 });
    }
  }

  let synthGlow = 0, signalGlow = 0;
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const A = nodes.agents.map(n => pos(n, t)), S = pos(nodes.synth, t), G = pos(nodes.signal, t);

    ctx.lineWidth = 1.5; ctx.strokeStyle = C.line;
    A.forEach(a => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(S.x, S.y); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(G.x, G.y); ctx.stroke();

    if (!reduce) spawn(t);
    packets = packets.filter(pk => {
      pk.p += pk.v;
      let x0, y0, x1, y1;
      if (pk.seg === 0) { x0 = A[pk.from].x; y0 = A[pk.from].y; x1 = S.x; y1 = S.y; }
      else { x0 = S.x; y0 = S.y; x1 = G.x; y1 = G.y; }
      if (pk.p >= 1) {
        if (pk.seg === 0) { synthGlow = 1; if (Math.random() < 0.35) { pk.seg = 1; pk.p = 0; pk.v *= 1.4; return true; } return false; }
        signalGlow = 1; return false;
      }
      const x = x0 + (x1 - x0) * pk.p, y = y0 + (y1 - y0) * pk.p;
      ctx.beginPath(); ctx.fillStyle = C.accent; ctx.arc(x, y, pk.seg ? 3.5 : 2.6, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    synthGlow *= 0.94; signalGlow *= 0.95;

    ctx.font = '12px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
    A.forEach((a, i) => {
      node(a.x, a.y, nodes.agents[i].r, 0);
      ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(sources[i], a.x - 16, a.y);
    });
    node(S.x, S.y, nodes.synth.r, synthGlow);
    ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.fillText('synthesis', S.x, S.y + 30);
    node(G.x, G.y, nodes.signal.r, signalGlow, true);
    ctx.fillStyle = C.ink; ctx.fillText('cited signal', G.x, G.y + 28);

    if (!reduce) requestAnimationFrame(draw);
  }

  function node(x, y, r, glow, filled) {
    if (glow > 0.02) {
      ctx.beginPath(); ctx.fillStyle = `rgba(${C.rgb},${0.25 * glow})`;
      ctx.arc(x, y, r + 14 * glow, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = filled ? C.accent : C.surface; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.accent; ctx.stroke();
  }

  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  cv.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
  window.addEventListener('resize', layout);
  layout();
  requestAnimationFrame(draw);
})();
