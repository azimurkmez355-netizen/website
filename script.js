(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PHONE = '905355534092';

  /* ---------- CTA routing: call on mobile, WhatsApp on desktop ---------- */
  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
  }

  function handleCTA(message) {
    if (isMobileDevice()) {
      window.location.href = 'tel:+' + PHONE;
    } else {
      const text = encodeURIComponent(message || 'Bilgi almak istiyorum');
      window.open('https://wa.me/' + PHONE + '?text=' + text, '_blank', 'noopener');
    }
  }

  document.querySelectorAll('[data-cta]').forEach((btn) => {
    btn.addEventListener('click', () => handleCTA(btn.dataset.cta));
  });

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Scroll progress bar ---------- */
  const progressBar = document.getElementById('scrollProgress');
  const header = document.getElementById('siteHeader');

  function onScroll() {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
    if (header) header.classList.toggle('scrolled', doc.scrollTop > 30);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Stat counters ---------- */
  function animateCount(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    if (isNaN(target)) return;
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const statEls = document.querySelectorAll('.stat-value[data-target]');
  if ('IntersectionObserver' in window) {
    const statIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            prefersReducedMotion
              ? (entry.target.textContent = entry.target.dataset.target + (entry.target.dataset.suffix || ''))
              : animateCount(entry.target);
            statIo.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    statEls.forEach((el) => statIo.observe(el));
  }

  /* ---------- Pricing toggle ---------- */
  const billingSwitch = document.getElementById('billingSwitch');
  const priceValues = document.querySelectorAll('.price-value');
  const periodEls = document.querySelectorAll('.price-period');
  let yearly = false;

  function formatTL(value) {
    return '₺' + Number(value).toLocaleString('tr-TR');
  }

  function animatePrice(el, target) {
    const current = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
    if (prefersReducedMotion) {
      el.textContent = formatTL(target);
      return;
    }
    const duration = 450;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(current + (target - current) * eased);
      el.textContent = formatTL(value);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function burstConfetti(originEl) {
    if (prefersReducedMotion) return;
    const rect = originEl.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const colors = ['#b8860b', '#8a6410', '#d9a635', '#4a3510'];
    const particles = Array.from({ length: 36 }, () => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * -8 - 2,
      size: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    }));

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach((p) => {
        p.vy += 0.28;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.018;
        if (p.life > 0) {
          alive = true;
          ctx.globalAlpha = Math.max(p.life, 0);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      });
      if (alive) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  if (billingSwitch) {
    billingSwitch.addEventListener('click', () => {
      yearly = !yearly;
      billingSwitch.setAttribute('aria-checked', String(yearly));
      billingSwitch.classList.toggle('checked', yearly);

      priceValues.forEach((el) => {
        const target = yearly ? el.dataset.yearly : el.dataset.monthly;
        animatePrice(el, target);
      });
      periodEls.forEach((el) => { el.textContent = yearly ? '/yıl' : '/ay'; });

      if (yearly) burstConfetti(billingSwitch);
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Subtle parallax on hero glows ---------- */
  if (!prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    const glows = document.querySelectorAll('.hero .glow');
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 24;
      const y = (e.clientY / window.innerHeight - 0.5) * 24;
      glows.forEach((g, i) => {
        const depth = (i + 1) * 0.6;
        g.style.translate = `${x * depth}px ${y * depth}px`;
      });
    }, { passive: true });
  }
})();
