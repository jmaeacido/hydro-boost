const revealItems = document.querySelectorAll(".reveal");
const counters = document.querySelectorAll("[data-count]");
const tiltTarget = document.querySelector("[data-tilt]");
const calc = document.querySelector("[data-calc]");
const gaugeRing = document.querySelector("[data-gauge-ring]");
const reviewShell = document.querySelector("[data-review-shell]");
const GAE_MAX_OZ = 250;
const GAE_CIRC = 327;

// Evidence-based hydration model:
// - Baseline: 35 mL/kg/day (clinical weight-scaled guideline; NASEM AI ≈ 74–101 oz from beverages).
// - Exercise: ACSM 0.4–0.8 L/h by intensity, scaled for climate, capped at 80% of estimated sweat loss.
// - Gummies: partial sodium replacement from estimated sweat losses (NATA sweat sodium range), per 150 mg/gummy.
const HYDRATION = {
  ML_PER_KG_BASE: 35,
  LB_TO_KG: 0.453592,
  ML_PER_OZ: 29.5735,
  EXERCISE_L_PER_HR: { light: 0.4, moderate: 0.6, high: 0.8 },
  CLIMATE_MULT: { cool: 1, warm: 1.15, hot: 1.3 },
  EXERCISE_REPLACE_RATIO: 0.8,
  SHORT_SESSION_MIN: 30,
  SHORT_SESSION_FACTOR: 0.5,
  ACTIVE_DAY_BONUS_OZ: { light: 0, moderate: 12, high: 20 },
  SWEAT_NA_MG_PER_L: 800,
  NA_REPLACE_RATIO: 0.5,
  NA_PER_GUMMY_MG: 150,
  GUMMY_MIN: 1,
  GUMMY_MAX: 4
};

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

function mlToOz(ml) {
  return ml / HYDRATION.ML_PER_OZ;
}

function baselineOz(weightLb) {
  return mlToOz(weightLb * HYDRATION.LB_TO_KG * HYDRATION.ML_PER_KG_BASE);
}

function exerciseOz(activity, climate, durationMin) {
  if (durationMin <= 0) return 0;
  const hours = durationMin / 60;
  let liters = HYDRATION.EXERCISE_L_PER_HR[activity] * HYDRATION.CLIMATE_MULT[climate] * hours;
  if (durationMin < HYDRATION.SHORT_SESSION_MIN) {
    liters *= HYDRATION.SHORT_SESSION_FACTOR;
  }
  return mlToOz(liters * 1000 * HYDRATION.EXERCISE_REPLACE_RATIO);
}

function recommendGummies(activity, climate, durationMin) {
  if (durationMin <= 0) {
    return "1–2 gummies for daily support (per label)";
  }

  const hours = durationMin / 60;
  const sweatLiters = HYDRATION.EXERCISE_L_PER_HR[activity] * HYDRATION.CLIMATE_MULT[climate] * hours;
  const targetNaMg = sweatLiters * HYDRATION.SWEAT_NA_MG_PER_L * HYDRATION.NA_REPLACE_RATIO;
  const count = Math.min(
    HYDRATION.GUMMY_MAX,
    Math.max(HYDRATION.GUMMY_MIN, Math.ceil(targetNaMg / HYDRATION.NA_PER_GUMMY_MG))
  );
  const low = Math.max(HYDRATION.GUMMY_MIN, count - 1);
  const high = Math.min(HYDRATION.GUMMY_MAX, count + 1);
  const sodiumMg = count * HYDRATION.NA_PER_GUMMY_MG;

  if (low === high) {
    return `${count} gumm${count === 1 ? "y" : "ies"} around training (~${sodiumMg} mg sodium)`;
  }
  return `${low}–${high} gummies around training (~${low * HYDRATION.NA_PER_GUMMY_MG}–${high * HYDRATION.NA_PER_GUMMY_MG} mg sodium)`;
}

function trainingDayOz(weightLb, activity, climate, durationMin) {
  return baselineOz(weightLb)
    + HYDRATION.ACTIVE_DAY_BONUS_OZ[activity]
    + exerciseOz(activity, climate, durationMin);
}

function updateGauge(ounces) {
  if (!gaugeRing) return;
  const pct = Math.min(ounces / GAE_MAX_OZ, 1);
  gaugeRing.style.strokeDashoffset = String(GAE_CIRC * (1 - pct));
}

function updateCalc() {
  if (!calc) return;
  const weight = Number(calc.weight.value);
  const activity = calc.activity.value;
  const climate = calc.climate.value;
  const duration = Number(calc.duration.value);
  const ounces = Math.round(trainingDayOz(weight, activity, climate, duration));
  calc.querySelector("[data-weight-out]").textContent = `${weight} lb`;
  calc.querySelector("[data-duration-out]").textContent = `${duration} min`;
  calc.querySelector("[data-ounces]").textContent = ounces;
  calc.querySelector("[data-gummies]").textContent = recommendGummies(activity, climate, duration);
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
