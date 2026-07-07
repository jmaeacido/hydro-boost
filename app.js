const revealItems = document.querySelectorAll(".reveal");
const counters = document.querySelectorAll("[data-count]");
const tiltTarget = document.querySelector("[data-tilt]");
const calc = document.querySelector("[data-calc]");
const gaugeRing = document.querySelector("[data-gauge-ring]");
const reviewShell = document.querySelector("[data-review-shell]");
const GAE_MAX_OZ = 200;
const GAE_CIRC = 327;

const reviews = [
  {
    avatar: "JR",
    tag: "Marathon Prep",
    stars: "★★★★★",
    quote: "I keep these in my gym bag. No bottle, no powder — just fast hydration after long runs.",
    cite: "Jordan R. · Distance Runner"
  },
  {
    avatar: "TC",
    tag: "CrossFit",
    stars: "★★★★★",
    quote: "Two gummies between WODs and I'm not reaching for a sugary sports drink. Game changer.",
    cite: "Taylor C. · CrossFit Athlete"
  },
  {
    avatar: "KL",
    tag: "Trail Running",
    stars: "★★★★★",
    quote: "Long rides and hot trail runs — these are simpler than mixing powders in the backcountry.",
    cite: "Kai L. · Ultra Runner"
  }
];

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index % 6, 5) * 40}ms`;
  revealObserver.observe(item);
});

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.count);
    const start = performance.now();
    const duration = 600;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - progress, 4)));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    counterObserver.unobserve(el);
  });
});
counters.forEach((counter) => counterObserver.observe(counter));

if (tiltTarget) {
  window.addEventListener("mousemove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 2;
    const y = (event.clientY / window.innerHeight - 0.5) * 2;
    tiltTarget.style.transform = `perspective(1100px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
  }, { passive: true });
  window.addEventListener("mouseleave", () => {
    tiltTarget.style.transform = "";
  });
}

document.querySelectorAll(".ingredient").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".ingredient").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector("[data-ingredient-detail]").textContent = button.dataset.info;
    document.querySelector("[data-ingredient-dose]").textContent = `${button.dataset.dose} per serving`;
  });
});

let reviewIndex = 0;
let reviewTimer;
const reviewEl = document.querySelector("[data-review]");

function renderReview() {
  if (!reviewEl) return;
  const review = reviews[reviewIndex];
  reviewEl.animate(
    [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 280, easing: "ease-out" }
  );
  reviewEl.querySelector(".avatar").textContent = review.avatar;
  reviewEl.querySelector(".review-tag").textContent = review.tag;
  reviewEl.querySelector(".stars").textContent = review.stars;
  reviewEl.querySelector("blockquote").textContent = `"${review.quote}"`;
  reviewEl.querySelector("cite").textContent = review.cite;
}

function startReviewTimer() {
  clearInterval(reviewTimer);
  reviewTimer = setInterval(() => {
    reviewIndex = (reviewIndex + 1) % reviews.length;
    renderReview();
  }, 5200);
}

document.querySelector("[data-prev]")?.addEventListener("click", () => {
  reviewIndex = (reviewIndex + reviews.length - 1) % reviews.length;
  renderReview();
  startReviewTimer();
});
document.querySelector("[data-next]")?.addEventListener("click", () => {
  reviewIndex = (reviewIndex + 1) % reviews.length;
  renderReview();
  startReviewTimer();
});

if (reviewShell) {
  reviewShell.addEventListener("mouseenter", () => clearInterval(reviewTimer));
  reviewShell.addEventListener("mouseleave", startReviewTimer);
  reviewShell.addEventListener("focusin", () => clearInterval(reviewTimer));
  reviewShell.addEventListener("focusout", startReviewTimer);
}
startReviewTimer();

function updateGauge(ounces) {
  if (!gaugeRing) return;
  const pct = Math.min(ounces / GAE_MAX_OZ, 1);
  gaugeRing.style.strokeDashoffset = String(GAE_CIRC * (1 - pct));
}

function updateCalc() {
  if (!calc) return;
  const weight = Number(calc.weight.value);
  const activity = Number(calc.activity.value);
  const climate = Number(calc.climate.value);
  const duration = Number(calc.duration.value);
  const ounces = Math.round((weight * 0.55 * activity * climate) + (duration * 0.22));
  calc.querySelector("[data-weight-out]").textContent = `${weight} lb`;
  calc.querySelector("[data-duration-out]").textContent = `${duration} min`;
  calc.querySelector("[data-ounces]").textContent = ounces;
  const gummyEl = calc.querySelector("[data-gummies]");
  if (duration > 60) {
    gummyEl.textContent = "3–4 gummies around training";
  } else if (duration > 0) {
    gummyEl.textContent = "2–3 gummies around training";
  } else {
    gummyEl.textContent = "1–2 gummies for daily support";
  }
  updateGauge(ounces);
}
calc?.addEventListener("input", updateCalc);
updateCalc();

document.querySelectorAll(".magnetic").forEach((el) => {
  el.addEventListener("pointermove", (event) => {
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.06}px, ${y * 0.1}px) skewX(-1deg)`;
  });
  el.addEventListener("pointerleave", () => {
    el.style.transform = "";
  });
});

const barObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll(".bar-fill").forEach((bar) => {
      const w = bar.style.getPropertyValue("--w");
      bar.style.width = "0";
      requestAnimationFrame(() => {
        bar.style.width = `calc(${w} * 1%)`;
      });
    });
    barObserver.unobserve(entry.target);
  });
}, { threshold: 0.3 });
document.querySelectorAll(".electrolyte-bars").forEach((el) => barObserver.observe(el));

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".gallery-card--hover-video").forEach((card) => {
  const video = card.querySelector(".gallery-video");
  if (!video || reduceMotion) return;
  const startAt = Number(video.dataset.start || 0);
  card.addEventListener("mouseenter", () => {
    video.currentTime = startAt;
    video.play().catch(() => {});
  });
  card.addEventListener("mouseleave", () => {
    video.pause();
    video.currentTime = startAt;
  });
});

const lottieTargets = document.querySelectorAll(".icon-lottie[data-src]");
if (lottieTargets.length && window.lottie) {
  lottieTargets.forEach((el) => {
    const isCycle = el.closest(".icon-cycle");
    const isRun = el.closest(".icon-run");
    const anim = lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop: !reduceMotion,
      autoplay: !reduceMotion,
      path: el.dataset.src,
      rendererSettings: isCycle || isRun
        ? { preserveAspectRatio: "xMidYMid meet", className: "icon-lottie-svg" }
        : undefined
    });
    if (reduceMotion) anim.goToAndStop(0, true);
  });
}
