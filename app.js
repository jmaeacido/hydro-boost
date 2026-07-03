const header = document.querySelector("[data-header]");
const revealItems = document.querySelectorAll(".reveal");
const counters = document.querySelectorAll("[data-count]");
const tiltTarget = document.querySelector("[data-tilt]");
const calc = document.querySelector("[data-calc]");
const reviews = [
  {
    avatar: "JR",
    stars: "★★★★★",
    quote: "I keep these in my gym bag. No bottle, no powder, just easy hydration after training.",
    cite: "Jordan R. · Runner"
  },
  {
    avatar: "AM",
    stars: "★★★★★",
    quote: "Perfect for travel days. The gummies are easy, clean, and actually feel premium.",
    cite: "Avery M. · Frequent flyer"
  },
  {
    avatar: "KL",
    stars: "★★★★★",
    quote: "I use them before long rides and after hot workouts. So much simpler than mixing powders.",
    cite: "Kai L. · Cyclist"
  }
];

function onScroll() {
  header.classList.toggle("scrolled", window.scrollY > 30);
}

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.16 });

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index % 6, 5) * 55}ms`;
  revealObserver.observe(item);
});

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.count);
    const start = performance.now();
    const duration = 900;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
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
    tiltTarget.style.transform = `perspective(1100px) rotateY(${x * 7}deg) rotateX(${-y * 5}deg) translateY(${Math.abs(y) * -8}px)`;
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
  });
});

let reviewIndex = 0;
const reviewEl = document.querySelector("[data-review]");
function renderReview() {
  if (!reviewEl) return;
  const review = reviews[reviewIndex];
  reviewEl.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 360, easing: "ease-out" });
  reviewEl.querySelector(".avatar").textContent = review.avatar;
  reviewEl.querySelector(".stars").textContent = review.stars;
  reviewEl.querySelector("blockquote").textContent = `“${review.quote}”`;
  reviewEl.querySelector("cite").textContent = review.cite;
}
document.querySelector("[data-prev]")?.addEventListener("click", () => {
  reviewIndex = (reviewIndex + reviews.length - 1) % reviews.length;
  renderReview();
});
document.querySelector("[data-next]")?.addEventListener("click", () => {
  reviewIndex = (reviewIndex + 1) % reviews.length;
  renderReview();
});
setInterval(() => {
  reviewIndex = (reviewIndex + 1) % reviews.length;
  renderReview();
}, 5200);

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
  calc.querySelector("[data-gummies]").textContent = duration > 60 ? "3-4 gummies around training" : duration > 0 ? "2-3 gummies around training" : "1-2 gummies for daily support";
}
calc?.addEventListener("input", updateCalc);
updateCalc();

let quantity = 1;
const qtyOut = document.querySelector("[data-qty]");
document.querySelector("[data-qty-minus]")?.addEventListener("click", () => {
  quantity = Math.max(1, quantity - 1);
  qtyOut.textContent = quantity;
});
document.querySelector("[data-qty-plus]")?.addEventListener("click", () => {
  quantity = Math.min(12, quantity + 1);
  qtyOut.textContent = quantity;
});

document.querySelectorAll(".magnetic").forEach((el) => {
  el.addEventListener("pointermove", (event) => {
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.08}px, ${y * 0.14}px) scale(1.025)`;
  });
  el.addEventListener("pointerleave", () => {
    el.style.transform = "";
  });
});
