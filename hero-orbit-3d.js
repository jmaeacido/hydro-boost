import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL_URL = "assets/3D%20resources/hydroboost.glb";
const ASSET_BASE = "assets/3D%20resources/";
// The source scene keeps spare gummies parked high above the bottle (physics-sim leftovers).
const STRAY_GUMMY_MIN_Y = 6;
const MODEL_TARGET_HEIGHT = 2.55;
const ORBIT_RADIUS = 1.72;
const ORB_MODEL_SIZE = 0.42;
const ORB_HIT_RADIUS = 0.38;
const DRAG_THRESHOLD_PX = 6;

// Equal angular spacing around the shared orbit (72° apart).
const INGREDIENT_ORDER = [
  "magnesium",
  "cordyceps",
  "sodium",
  "maca",
  "potassium"
];

const INGREDIENT_MODELS = {
  maca: "black-maca.glb",
  cordyceps: "cordycep.glb",
  magnesium: "magnesium.glb",
  sodium: "sodium.glb",
  potassium: "potassium.glb"
};

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

function fitObjectToSize(object, targetSize) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / longest;
  object.scale.setScalar(scale);
  object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

function setMeshOpacity(root, opacity) {
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => {
      if (!material.transparent) {
        material.transparent = true;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
      material.depthWrite = opacity > 0.95;
    });
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

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
  } catch {
    container.classList.add("hero-orbit-3d--failed");
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = "hero-orbit-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.1);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  camera.position.set(0, 0.28, 5);
  camera.lookAt(0, 0, 0);

  const root = new THREE.Group();
  scene.add(root);

  const keyLight = new THREE.DirectionalLight(0xfff4d6, 1.15);
  keyLight.position.set(2.4, 3.8, 4.2);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xe8ff3a, 0.5);
  rimLight.position.set(-3.2, 1.4, -2.4);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0x88bbff, 0.3, 12);
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
  floor.position.y = -1.5;
  scene.add(floor);

  const grid = new THREE.GridHelper(6, 24, 0xe8ff3a, 0x2a2a2a);
  grid.position.y = -1.49;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);

  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(ORBIT_RADIUS, 0.008, 12, 120),
    new THREE.MeshBasicMaterial({
      color: 0xe8ff3a,
      transparent: true,
      opacity: 0.18
    })
  );
  orbitRing.rotation.x = Math.PI / 2.35;

  // One turntable: rotating the bottle also rotates the ingredient orbit.
  const turntable = new THREE.Group();
  root.add(turntable);

  const bottleGroup = new THREE.Group();
  turntable.add(bottleGroup);
  turntable.add(orbitRing);

  const aura = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 48),
    new THREE.MeshBasicMaterial({
      color: 0xe8ff3a,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = -1.45;
  root.add(aura);

  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.x = 0.42;
  turntable.add(orbitPivot);

  const ingredientMeshes = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(999, 999);
  let hoveredMesh = null;
  let focusedKey = null;
  let lockedKey = null;
  let isExploring = false;
  let isVisible = true;
  let animationId = 0;
  let turntableYaw = 0;
  let dragVelocity = 0;
  let isDragging = false;
  let dragMoved = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let lastPointerX = 0;
  let activePointerId = null;
  let resizeObserver = null;
  let exploreObserver = null;
  let visibilityObserver = null;

  function setExploring(next) {
    isExploring = next;
    aura.material.opacity = next ? 0.14 : 0.08;
  }

  function setFocusedIngredient(key) {
    focusedKey = key || null;
    ingredientMeshes.forEach((entry) => {
      const active = !key || entry.key === key;
      entry.group.scale.setScalar(active && key ? 1.12 : 1);
    });
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickIngredient() {
    raycaster.setFromCamera(pointer, camera);
    const targets = [];
    ingredientMeshes.forEach((entry) => {
      targets.push(entry.hit);
      if (entry.shell) targets.push(entry.shell);
      if (entry.modelRoot) targets.push(entry.modelRoot);
      if (entry.core) targets.push(entry.core);
    });
    const hits = raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj) {
        if (obj.userData?.ingredientKey) return obj.userData.ingredientKey;
        obj = obj.parent;
      }
    }
    return null;
  }

  function selectIngredient(key) {
    if (!key || key === lockedKey) return;
    lockedKey = key;
    const button = ingredientButtons.find((item) => item.dataset.ingredientKey === key);
    if (button) onIngredientFocus(button);
    setFocusedIngredient(key);
  }

  function syncHoverCursor(key) {
    if (isDragging) {
      renderer.domElement.style.cursor = "grabbing";
      return;
    }
    renderer.domElement.style.cursor = key ? "pointer" : "grab";
  }

  function handlePointerDown(event) {
    updatePointer(event);
    activePointerId = event.pointerId;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    lastPointerX = event.clientX;
    dragMoved = false;
    isDragging = false;
    dragVelocity = 0;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    updatePointer(event);

    if (activePointerId !== null && event.pointerId === activePointerId) {
      const dx = event.clientX - pointerDownX;
      const dy = event.clientY - pointerDownY;
      if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        isDragging = true;
        dragMoved = true;
        syncHoverCursor(null);
      }
      if (isDragging) {
        const deltaX = event.clientX - lastPointerX;
        const deltaYaw = deltaX * 0.008;
        turntableYaw += deltaYaw;
        dragVelocity = deltaYaw;
        lastPointerX = event.clientX;
        return;
      }
    }

    lastPointerX = event.clientX;
    const key = pickIngredient();
    if (key === hoveredMesh) {
      syncHoverCursor(key);
      return;
    }
    hoveredMesh = key;
    syncHoverCursor(key);
    // Hover only highlights orbs — the study panel stays until another ingredient is clicked.
    setFocusedIngredient(key || lockedKey);
  }

  function handlePointerUp(event) {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    updatePointer(event);
    const wasDrag = dragMoved;
    isDragging = false;
    activePointerId = null;
    renderer.domElement.releasePointerCapture?.(event.pointerId);

    if (!wasDrag) {
      selectIngredient(pickIngredient());
    }
    syncHoverCursor(pickIngredient());
  }

  function handlePointerLeave() {
    if (activePointerId !== null) return;
    pointer.set(999, 999);
    hoveredMesh = null;
    syncHoverCursor(null);
    setFocusedIngredient(lockedKey);
  }

  function animate(timeMs) {
    animationId = requestAnimationFrame(animate);
    if (!isVisible) return;

    const time = timeMs * 0.001;

    // Coast after a drag; auto-spin is brisk when idle and eases off on hover
    // so orbs are easy to aim at.
    if (!isDragging) {
      if (Math.abs(dragVelocity) > 0.0004) {
        turntableYaw += dragVelocity;
        dragVelocity *= 0.94;
      } else {
        dragVelocity = 0;
        if (hoveredMesh) {
          // hold still while aiming at an orb
        } else {
          turntableYaw += isExploring ? 0.0012 : 0.0038;
        }
      }
    }

    turntable.rotation.y = turntableYaw;
    aura.scale.setScalar(1 + Math.sin(time * 1.4) * 0.04);

    ingredientMeshes.forEach((entry) => {
      const reveal = entry.group.userData.targetOpacity ?? 1;
      const delay = entry.group.userData.revealDelay ?? 0;
      const easedReveal = THREE.MathUtils.clamp(reveal - delay, 0, 1);
      const dimmed = focusedKey && entry.key !== focusedKey;
      entry.group.visible = easedReveal > 0.01;

      const shellTarget = easedReveal * (dimmed ? 0.28 : 0.55);
      entry.shell.material.opacity = THREE.MathUtils.lerp(
        entry.shell.material.opacity,
        shellTarget,
        0.08
      );

      const contentTarget = easedReveal * (dimmed ? 0.4 : 1);
      if (entry.modelRoot) {
        const current = entry.modelRoot.userData.opacity ?? 0;
        const next = THREE.MathUtils.lerp(current, contentTarget, 0.08);
        entry.modelRoot.userData.opacity = next;
        setMeshOpacity(entry.modelRoot, next);
      } else if (entry.core) {
        entry.core.material.opacity = THREE.MathUtils.lerp(
          entry.core.material.opacity,
          contentTarget,
          0.08
        );
      }

      entry.label.material.opacity = THREE.MathUtils.lerp(
        entry.label.material.opacity,
        easedReveal * (dimmed ? 0.35 : 0.95),
        0.08
      );
      entry.group.position.y = Math.sin(time * 1.6 + entry.phase) * 0.04;
      if (entry.modelRoot) {
        entry.modelRoot.rotation.y = time * 0.55 + entry.phase;
      }
      entry.label.lookAt(camera.position);
    });

    renderer.render(scene, camera);
  }

  async function buildModel() {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const model = gltf.scene;

    [...model.children].forEach((node) => {
      if (node.name.startsWith("Gummy") && node.position.y > STRAY_GUMMY_MIN_Y) {
        model.remove(node);
      }
    });

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    model.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((material) => {
        if (material.map) {
          material.map.anisotropy = maxAnisotropy;
          material.map.needsUpdate = true;
        }
      });
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = MODEL_TARGET_HEIGHT / size.y;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    bottleGroup.add(model);
  }

  async function buildOrbs() {
    const loader = new GLTFLoader();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const ingredientSources = await Promise.all(
      ingredientButtons.map(async (button) => {
        const key = button.dataset.ingredientKey;
        const name = button.dataset.name || "";
        const modelFile = INGREDIENT_MODELS[key];
        let model = null;

        if (modelFile) {
          try {
            const gltf = await loader.loadAsync(`${ASSET_BASE}${encodeURIComponent(modelFile)}`);
            model = gltf.scene;
            model.traverse((obj) => {
              if (!obj.isMesh || !obj.material) return;
              const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
              materials.forEach((material) => {
                if (material.map) {
                  material.map.anisotropy = maxAnisotropy;
                  material.map.needsUpdate = true;
                }
                material.transparent = true;
                material.opacity = 0;
              });
            });
            model.userData.opacity = 0;
          } catch (err) {
            console.warn(`[hero-orbit-3d] failed to load ${modelFile}`, err);
          }
        }

        let texture = null;
        if (!model) {
          const image = button.querySelector("img");
          const src = image?.getAttribute("src") || "";
          if (src) {
            texture = await loadTexture(src);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = maxAnisotropy;
          }
        }

        return { key, name, model, texture };
      })
    );

    // Place ingredients in DOM/order mapping, but force equal orbit intervals.
    const orderedSources = INGREDIENT_ORDER.map((key, index) => {
      const source = ingredientSources.find((item) => item.key === key)
        || ingredientSources[index]
        || { key, name: key, model: null, texture: null };
      return {
        ...source,
        angle: -Math.PI / 2 + (index / INGREDIENT_ORDER.length) * Math.PI * 2
      };
    });

    orderedSources.forEach((source, index) => {
      const group = new THREE.Group();
      group.userData.targetOpacity = 1;
      group.userData.revealDelay = index * 0.08;
      group.userData.ingredientKey = source.key;

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(ORB_HIT_RADIUS, 16, 16),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      hit.userData.ingredientKey = source.key;

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 32, 32),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          roughness: 0.04,
          metalness: 0,
          transmission: 0.92,
          thickness: 0.35,
          ior: 1.2,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          depthWrite: false
        })
      );
      shell.userData.ingredientKey = source.key;

      let core = null;
      let modelRoot = null;

      if (source.model) {
        modelRoot = new THREE.Group();
        modelRoot.userData.ingredientKey = source.key;
        const fitted = source.model;
        fitObjectToSize(fitted, ORB_MODEL_SIZE);
        fitted.traverse((obj) => {
          obj.userData.ingredientKey = source.key;
        });
        modelRoot.add(fitted);
        group.add(modelRoot);
      } else {
        core = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 24, 24),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: source.texture,
            transparent: true,
            opacity: 0,
            roughness: 0.85,
            metalness: 0
          })
        );
        core.userData.ingredientKey = source.key;
        group.add(core);
      }

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
        new THREE.PlaneGeometry(0.62, 0.16),
        new THREE.MeshBasicMaterial({
          map: labelTexture,
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      label.position.y = -0.38;
      label.userData.ingredientKey = source.key;

      group.add(hit, shell, label);

      group.position.set(
        Math.cos(source.angle) * ORBIT_RADIUS,
        0.1,
        Math.sin(source.angle) * ORBIT_RADIUS
      );
      group.lookAt(0, 0.1, 0);

      orbitPivot.add(group);
      ingredientMeshes.push({
        key: source.key,
        group,
        hit,
        shell,
        core,
        modelRoot,
        label,
        phase: source.angle
      });
    });
  }

  Promise.all([buildModel(), buildOrbs()])
    .then(() => {
      resize();
      stage.classList.add("has-3d");
      animate(0);
    })
    .catch((err) => {
      console.error("[hero-orbit-3d]", err);
      stage.classList.remove("has-3d");
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

  renderer.domElement.style.cursor = "grab";
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointercancel", handlePointerUp);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

  return {
    destroy() {
      cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      exploreObserver?.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      stage.classList.remove("has-3d");
    },
    setExploring,
    clearSelection() {
      lockedKey = null;
      setFocusedIngredient(null);
    },
    getOrbScreenPositions() {
      const rect = renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector3();
      return ingredientMeshes.map((entry) => {
        entry.group.getWorldPosition(v);
        v.project(camera);
        return {
          key: entry.key,
          x: rect.left + ((v.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - v.y) / 2) * rect.height,
          inFront: v.z < 1
        };
      });
    }
  };
}

function autoInit() {
  const container = document.querySelector("[data-hero-orbit]");
  if (!container) return;
  const bridge = window.__heroOrbitBridge || {};
  window.__heroOrbit = initHeroOrbit3d(container, {
    ingredients: bridge.ingredients || Array.from(document.querySelectorAll(".hero-ingredient")),
    onIngredientFocus: bridge.focus,
    onIngredientBlur: bridge.blur
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInit, { once: true });
} else {
  autoInit();
}
