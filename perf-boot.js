const orbitHost = document.querySelector("[data-hero-orbit]");
if (!orbitHost) return;

let booted = false;

async function bootOrbit() {
  if (booted) return;
  booted = true;
  try {
    const { bootHeroOrbit3d } = await import("./hero-orbit-3d.js");
    bootHeroOrbit3d(orbitHost);
  } catch (err) {
    console.warn("[perf-boot] orbit module failed", err);
    orbitHost.classList.add("hero-orbit-3d--failed");
  }
}

const orbitObserver = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      bootOrbit();
      orbitObserver.disconnect();
    }
  },
  { rootMargin: "900px 0px", threshold: 0 }
);

orbitObserver.observe(orbitHost);
