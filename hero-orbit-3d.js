import * as THREE from "three";

const ASSET_BASE = "assets/3D%20resources/";
const BOTTLE_TEXTURES = [
  { file: "front-side.png", angle: 0 },
  { file: "nutrition-side.png", angle: (Math.PI * 2) / 3 },
  { file: "usage-side.png", angle: (Math.PI * 4) / 3 }
];

const INGREDIENT_LAYOUT = [
  { key: "magnesium", angle: -Math.PI / 2, size: 1.08 },
  { key: "cordyceps", angle: -Math.PI / 6, size: 1 },
  { key: "sodium", angle: Math.PI / 6, size: 1 },
  { key: "maca", angle: Math.PI / 2, size: 0.96 },
  { key: "potassium", angle: (Math.PI * 5) / 6, size: 0.96 }
];

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initHeroOrbit3d(container, options = {}) {
  if (!container || prefersReducedMotion()) return null;

  const ingredientButtons = options.ingredients || [];
  const onIngredientFocus = options.onIngredientFocus || (() => {});
  const onIngredientBlur = options.onIngredientBlur || (() => {});
  const touchMode = window.matchMedia("(hover: none)");

  const stage = container.closest(".hero-product-stage") || container;
  const exploreRoot = container.closest("[data-hero-interactive]");

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = "hero-orbit-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.14);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.position.set(0, 0.35, 4.35);
  camera.lookAt(0, 0.05, 0);

  const root = new THREE.Group();
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xffffff, 0.42);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff4d6, 1.35);
  keyLight.position.set(2.4, 3.8, 4.2);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xe8ff3a, 0.55);
  rimLight.position.set(-3.2, 1.4, -2.4);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0x88bbff, 0.35, 12);
  fillLight.position.set(-1.8, -0.6, 2.4);
  scene.add(fillLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({
      color: 0x0a0a0a,
      transparent: true,
      opacity: 0.55
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.35;
  scene.add(floor);

  const grid = new THREE.GridHelper(6, 24, 0xe8ff3a, 0x2a2a2a);
  grid.position.y = -1.34;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);

  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.95, 0.008, 12, 120),
    new THREE.MeshBasicMaterial({
      color: 0xe8ff3a,
      transparent: true,
      opacity: 0.18
    })
  );
  orbitRing.rotation.x = Math.PI / 2.35;
  orbitRing.visible = false;
  root.add(orbitRing);

  const bottleGroup = new THREE.Group();
  bottleGroup.position.y = -0.05;
  root.add(bottleGroup);

  const aura = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 48),
    new THREE.MeshBasicMaterial({
      color: 0xe8ff3a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = -1.2;
  root.add(aura);

  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.x = 0.42;
  root.add(orbitPivot);

  const ingredientMeshes = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(999, 999);
  let hoveredMesh = null;
  let focusedKey = null;
  let isExploring = false;
  let isVisible = true;
  let animationId = 0;
  let bottleSpin = 0;
  let orbitSpin = 0;
  let resizeObserver = null;
  let exploreObserver = null;
  let visibilityObserver = null;

  function setExploring(next) {
    isExploring = next;
    orbitRing.visible = next;
    aura.material.opacity = next ? 0.12 : 0;
    ingredientMeshes.forEach((entry, index) => {
      const target = next ? 1 : 0;
      entry.group.userData.targetOpacity = target;
      entry.group.userData.revealDelay = index * 0.08;
    });
  }

  function setFocusedIngredient(key) {
    focusedKey = key || null;
    ingredientMeshes.forEach((entry) => {
      const active = !key || entry.key === key;
      entry.group.scale.setScalar(active && key ? entry.baseScale * 1.12 : entry.baseScale);
    });
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickIngredient() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      ingredientMeshes.map((entry) => entry.shell),
      false
    );
    return hits[0]?.object?.userData?.ingredientKey || null;
  }

  function handlePointerMove(event) {
    updatePointer(event);
    const key = isExploring ? pickIngredient() : null;
    if (key === hoveredMesh) return;
    hoveredMesh = key;
    renderer.domElement.style.cursor = key ? "pointer" : isExploring ? "default" : "grab";
    if (key) {
      const button = ingredientButtons.find((item) => item.dataset.ingredientKey === key);
      if (button) onIngredientFocus(button);
      setFocusedIngredient(key);
    } else if (!touchMode.matches) {
      onIngredientBlur();
      setFocusedIngredient(null);
    }
  }

  function handlePointerLeave() {
    pointer.set(999, 999);
    hoveredMesh = null;
    renderer.domElement.style.cursor = "default";
    if (!touchMode.matches) {
      onIngredientBlur();
      setFocusedIngredient(null);
    }
  }

  function handleClick() {
    if (!isExploring) return;
    const key = pickIngredient();
    if (!key) {
      onIngredientBlur();
      setFocusedIngredient(null);
      return;
    }
    if (focusedKey === key) {
      onIngredientBlur();
      setFocusedIngredient(null);
      return;
    }
    const button = ingredientButtons.find((item) => item.dataset.ingredientKey === key);
    if (button) onIngredientFocus(button);
    setFocusedIngredient(key);
  }

  function animate(timeMs) {
    animationId = requestAnimationFrame(animate);
    if (!isVisible) return;

    const time = timeMs * 0.001;
    bottleSpin += 0.0032;
    orbitSpin += isExploring ? 0.0046 : 0.0018;
    bottleGroup.rotation.y = bottleSpin;
    orbitPivot.rotation.y = orbitSpin;
    aura.scale.setScalar(1 + Math.sin(time * 1.4) * 0.04);

    ingredientMeshes.forEach((entry) => {
      const reveal = entry.group.userData.targetOpacity ?? 0;
      const delay = entry.group.userData.revealDelay ?? 0;
      const easedReveal = THREE.MathUtils.clamp(reveal - delay, 0, 1);
      entry.group.visible = easedReveal > 0.01;
      entry.shell.material.opacity = THREE.MathUtils.lerp(
        entry.shell.material.opacity,
        easedReveal * (focusedKey && entry.key !== focusedKey ? 0.38 : 0.88),
        0.08
      );
      entry.core.material.opacity = THREE.MathUtils.lerp(
        entry.core.material.opacity,
        easedReveal * (focusedKey && entry.key !== focusedKey ? 0.45 : 1),
        0.08
      );
      entry.label.material.opacity = THREE.MathUtils.lerp(
        entry.label.material.opacity,
        easedReveal * (focusedKey && entry.key !== focusedKey ? 0.35 : 0.95),
        0.08
      );
      entry.group.position.y = Math.sin(time * 1.6 + entry.phase) * 0.04;
    });

    renderer.render(scene, camera);
  }

  async function buildScene() {
    const bottleHeight = 2.35;
    let panelWidth = 1.15;

    const bottleFaces = await Promise.all(
      BOTTLE_TEXTURES.map(async ({ file, angle }) => {
        const texture = await loadTexture(`${ASSET_BASE}${file}`);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const aspect = texture.image.width / texture.image.height;
        return { texture, angle, aspect };
      })
    );

    bottleFaces.forEach(({ aspect }) => {
      panelWidth = bottleHeight * aspect * 0.52;
    });

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(panelWidth * 0.34, panelWidth * 0.36, 0.22, 48),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.35,
        roughness: 0.42
      })
    );
    cap.position.y = bottleHeight * 0.43;
    bottleGroup.add(cap);

    bottleFaces.forEach(({ texture, angle }) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(panelWidth, bottleHeight),
        new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          roughness: 0.92,
          metalness: 0.02
        })
      );
      const radius = panelWidth * 0.34;
      plane.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
      plane.rotation.y = angle;
      bottleGroup.add(plane);
    });

    const glassShell = new THREE.Mesh(
      new THREE.CylinderGeometry(panelWidth * 0.36, panelWidth * 0.38, bottleHeight * 0.88, 48, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        roughness: 0.08,
        metalness: 0,
        transmission: 0.55,
        thickness: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    bottleGroup.add(glassShell);

    const ingredientSources = await Promise.all(
      ingredientButtons.map(async (button) => {
        const image = button.querySelector("img");
        const src = image?.getAttribute("src") || "";
        const texture = src ? await loadTexture(src) : null;
        if (texture) {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
        return {
          key: button.dataset.ingredientKey,
          name: button.dataset.name || "",
          texture
        };
      })
    );

    ingredientSources.forEach((source, index) => {
      const layout = INGREDIENT_LAYOUT[index] || { angle: 0, size: 1 };
      const group = new THREE.Group();
      group.userData.targetOpacity = 0;
      group.userData.revealDelay = index * 0.08;

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.24 * layout.size, 32, 32),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          roughness: 0.04,
          metalness: 0,
          transmission: 0.94,
          thickness: 0.35,
          ior: 1.2,
          clearcoat: 1,
          clearcoatRoughness: 0.08
        })
      );
      shell.userData.ingredientKey = source.key;

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * layout.size, 24, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: source.texture,
          transparent: true,
          opacity: 0,
          roughness: 0.85,
          metalness: 0
        })
      );

      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 512;
      labelCanvas.height = 128;
      const ctx = labelCanvas.getContext("2d");
      ctx.fillStyle = "rgba(8,8,8,0.82)";
      ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
      ctx.strokeStyle = "rgba(232,255,58,0.45)";
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, labelCanvas.width - 16, labelCanvas.height - 16);
      ctx.fillStyle = "#e8ff3a";
      ctx.font = "bold 44px Barlow, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((source.name || "").toUpperCase(), labelCanvas.width / 2, labelCanvas.height / 2);

      const labelTexture = new THREE.CanvasTexture(labelCanvas);
      labelTexture.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62 * layout.size, 0.16 * layout.size),
        new THREE.MeshBasicMaterial({
          map: labelTexture,
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      label.position.y = -0.34 * layout.size;

      group.add(shell, core, label);

      const orbitRadius = 1.95;
      group.position.set(
        Math.cos(layout.angle) * orbitRadius,
        0.1,
        Math.sin(layout.angle) * orbitRadius
      );
      group.lookAt(0, 0.1, 0);

      orbitPivot.add(group);
      ingredientMeshes.push({
        key: source.key,
        group,
        shell,
        core,
        label,
        baseScale: layout.size,
        phase: layout.angle
      });
    });
  }

  buildScene()
    .then(() => {
      resize();
      animate(0);
    })
    .catch(() => {
      container.classList.add("hero-orbit-3d--failed");
    });

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
    },
    { threshold: 0.08 }
  );
  visibilityObserver.observe(container);

  if (exploreRoot) {
    const syncExplore = () => setExploring(exploreRoot.classList.contains("is-exploring"));
    exploreObserver = new MutationObserver(syncExplore);
    exploreObserver.observe(exploreRoot, { attributes: true, attributeFilter: ["class"] });
    stage.addEventListener("mouseenter", () => setExploring(true));
    stage.addEventListener("mouseleave", () => {
      if (!exploreRoot.classList.contains("is-exploring")) setExploring(false);
    });
    syncExplore();
  }

  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
  renderer.domElement.addEventListener("click", handleClick);

  return {
    destroy() {
      cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      exploreObserver?.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.dispose();
      container.classList.remove("hero-orbit-3d--active");
    },
    setExploring,
    clearSelection() {
      setFocusedIngredient(null);
    }
  };
}
