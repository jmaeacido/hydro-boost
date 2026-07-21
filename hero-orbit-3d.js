import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const MODEL_URL = "assets/3D%20resources/hydroboost.glb?v=gummies30-20260720-1817";
const ASSET_BASE = "assets/3D%20resources/";
const ENV_URL = "assets/hdri/artist_workshop_1k.hdr";
// Full-bleed in-motion section backdrop (dark green + grid), replaces CSS.
const PAGE_BG_HEX = "#0b1209";
const PAGE_BG = 0x0b1209;
const PAGE_GRID_H = "rgba(232,255,58,0.035)";
const PAGE_GRID_V = "rgba(232,255,58,0.025)";
// The source scene keeps spare gummies parked high above the bottle (physics-sim leftovers).
const STRAY_GUMMY_MIN_Y = 6;
const MODEL_TARGET_HEIGHT = 2.55;
const ORBIT_RADIUS = 1.72;
const ORB_MODEL_SIZE = 0.42;
const ORB_HIT_RADIUS = 0.55;
const ORB_SHELL_RADIUS = 0.28;
const ORBIT_TILT = 0.42;
const DRAG_THRESHOLD_PX = 6;
// Click can be a bit forgiving; hover-pause must stay tight so idle spin doesn't die early.
const PICK_RADIUS_PX = 56;
const PICK_RADIUS_TOUCH_PX = 70;
const HOVER_RADIUS_PX = 40;
const HOVER_RADIUS_TOUCH_PX = 50;
// Left-front of the jar (toward the formula panel), in orbit XZ atan2(z, x) space.
const FOCUS_AZIMUTH = Math.PI * 0.72;
const SNAP_DURATION_MS = 720;
const FOCUS_SCALE = 1.34;
const DIM_SCALE = 0.84;

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
  magnesium: "Mg.glb",
  sodium: "Na.glb",
  potassium: "K.glb"
};

// Smaller GLBs first so light orbs appear while the heavy electrolytes download.
const ORB_LOAD_PRIORITY = ["cordyceps", "maca", "magnesium", "sodium", "potassium"];
const ORB_LOAD_CONCURRENCY = 2;
const ORB_LOAD_VIEWPORT_MARGIN = "400px 0px";

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

/** Tiled section backdrop — flat fill + grid only (no per-tile wash; that stacked). */
function paintPageBackground(canvas) {
  const size = 512;
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PAGE_BG_HEX;
  ctx.fillRect(0, 0, size, size);

  const step = size / 8;
  ctx.lineWidth = 2;
  ctx.strokeStyle = PAGE_GRID_V;
  ctx.beginPath();
  for (let x = 0; x <= size; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, size);
  }
  ctx.stroke();

  ctx.strokeStyle = PAGE_GRID_H;
  ctx.beginPath();
  for (let y = 0; y <= size; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
  }
  ctx.stroke();
}

export function initHeroOrbit3d(container, options = {}) {
  if (!container || prefersReducedMotion()) return null;

  const ingredientButtons = options.ingredients || [];
  const onIngredientFocus = options.onIngredientFocus || (() => {});
  const onIngredientBlur = options.onIngredientBlur || (() => {});
  const touchMode = window.matchMedia("(hover: none)");

  const section = container.closest(".in-motion") || container.parentElement;
  const stage = section?.querySelector(".hero-product-stage") || container;
  const exploreRoot = section?.querySelector("[data-hero-interactive]") || container.closest("[data-hero-interactive]");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
  } catch {
    container.classList.add("hero-orbit-3d--failed");
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(PAGE_BG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Match gltf.report / Khronos product viewing — not ACES, which blows out transmission.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = "hero-orbit-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  // Color background is what transmission samples reliably; grid plane matches CSS style.
  scene.background = new THREE.Color(PAGE_BG);

  const PAGE_BACKDROP_DIST = 14;
  const pageBgCanvas = document.createElement("canvas");
  const pageBgTexture = new THREE.CanvasTexture(pageBgCanvas);
  pageBgTexture.colorSpace = THREE.SRGBColorSpace;
  pageBgTexture.wrapS = THREE.RepeatWrapping;
  pageBgTexture.wrapT = THREE.RepeatWrapping;
  pageBgTexture.magFilter = THREE.LinearFilter;
  pageBgTexture.minFilter = THREE.LinearMipmapLinearFilter;
  paintPageBackground(pageBgCanvas);
  pageBgTexture.needsUpdate = true;

  const pageBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: pageBgTexture,
      depthTest: true,
      depthWrite: true,
      toneMapped: false
    })
  );
  pageBackdrop.frustumCulled = false;
  pageBackdrop.renderOrder = -1000;
  scene.add(pageBackdrop);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTexture = null;

  async function loadEnvironment() {
    const hdr = await new RGBELoader().loadAsync(ENV_URL);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    envTexture = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    scene.environment = envTexture;
  }

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 40);
  camera.position.set(0, 0.22, 6.1);
  camera.lookAt(0, 0, 0);

  const root = new THREE.Group();
  scene.add(root);

  let pageBgSyncKey = "";
  function syncPageBackground() {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const stageRect = stage.getBoundingClientRect();
    const key = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}:${Math.round(stageRect.left)}:${Math.round(stageRect.top)}:${Math.round(stageRect.width)}:${camera.aspect.toFixed(3)}`;
    if (key === pageBgSyncKey) return;
    pageBgSyncKey = key;

    paintPageBackground(pageBgCanvas);
    pageBgTexture.needsUpdate = true;

    // Keep the bottle on the optical axis (no root offset) — off-center placement
    // was keystoning the jar. Shift the frustum instead so it sits over the stage.
    if (stageRect.width) {
      const stageCx =
        (stageRect.left + stageRect.width / 2 - rect.left) / rect.width;
      const stageCy =
        (stageRect.top + stageRect.height / 2 - rect.top) / rect.height;
      const offsetX = (0.5 - stageCx) * rect.width;
      const offsetY = (0.5 - stageCy) * rect.height;
      camera.setViewOffset(rect.width, rect.height, offsetX, offsetY, rect.width, rect.height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();

    // Oversized so the shifted frustum never shows past the backdrop edges.
    const height =
      2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * PAGE_BACKDROP_DIST * 1.75;
    const width = height * camera.aspect;
    pageBackdrop.scale.set(width, height, 1);
    // One continuous grid; cell count scales gently with plane size.
    pageBgTexture.repeat.set(Math.max(6, width * 0.22), Math.max(6, height * 0.22));
    pageBackdrop.position.copy(camera.position);
    pageBackdrop.quaternion.copy(camera.quaternion);
    pageBackdrop.translateZ(-PAGE_BACKDROP_DIST);
  }

  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(ORBIT_RADIUS, 0.01, 12, 120),
    new THREE.MeshBasicMaterial({
      color: 0xe8ff3a,
      transparent: true,
      opacity: 0.28
    })
  );
  // Torus defaults to XY; lay it in the orbitPivot XZ plane so orbs sit on it.
  orbitRing.rotation.x = Math.PI / 2;

  // One turntable: rotating the bottle also rotates the ingredient orbit.
  const turntable = new THREE.Group();
  root.add(turntable);

  const bottleGroup = new THREE.Group();
  turntable.add(bottleGroup);

  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.x = ORBIT_TILT;
  turntable.add(orbitPivot);
  orbitPivot.add(orbitRing);

  const ingredientMeshes = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(999, 999);
  const pickWorld = new THREE.Vector3();
  let lastClientX = 0;
  let lastClientY = 0;
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
  let snapActive = false;
  let snapFromYaw = 0;
  let snapToYaw = 0;
  let snapStartMs = 0;
  const snapWorldPos = new THREE.Vector3();
  let resizeObserver = null;
  let exploreObserver = null;
  let visibilityObserver = null;
  let orbLoadObserver = null;
  let orbsStarted = false;

  function shortestAngleDelta(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  function cancelSnap() {
    snapActive = false;
  }

  function snapIngredientToFront(key) {
    const entry = ingredientMeshes.find((item) => item.key === key);
    if (!entry) return;
    // Sync matrices, then measure the orb's current world azimuth so tilt is included.
    turntable.rotation.y = turntableYaw;
    turntable.updateMatrixWorld(true);
    entry.group.getWorldPosition(snapWorldPos);
    const currentAzimuth = Math.atan2(snapWorldPos.z, snapWorldPos.x);
    // Increasing turntable yaw by d rotates world azimuth by -d.
    const deltaYaw = shortestAngleDelta(0, currentAzimuth - FOCUS_AZIMUTH);
    snapFromYaw = turntableYaw;
    snapToYaw = turntableYaw + deltaYaw;
    snapStartMs = performance.now();
    snapActive = true;
    dragVelocity = 0;
  }

  function setExploring(next) {
    isExploring = next;
  }

  function setFocusedIngredient(key) {
    focusedKey = key || null;
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    // View offset is reapplied in syncPageBackground after setSize.
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    pageBgSyncKey = "";
    syncPageBackground();
  }

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function screenPick(object3d, rect) {
    object3d.getWorldPosition(pickWorld);
    pickWorld.project(camera);
    if (pickWorld.z < -1 || pickWorld.z > 1) {
      return { dist: Infinity, depth: 1 };
    }
    const sx = rect.left + ((pickWorld.x + 1) / 2) * rect.width;
    const sy = rect.top + ((1 - pickWorld.y) / 2) * rect.height;
    return {
      dist: Math.hypot(lastClientX - sx, lastClientY - sy),
      depth: pickWorld.z
    };
  }

  function nearestIngredient(maxDist) {
    if (!ingredientMeshes.length) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    let bestKey = null;
    let bestScore = Infinity;

    for (const entry of ingredientMeshes) {
      const orb = screenPick(entry.group, rect);
      const label = entry.label ? screenPick(entry.label, rect) : { dist: Infinity, depth: 1 };
      const dist = Math.min(orb.dist, label.dist);
      if (dist > maxDist) continue;
      // Prefer nearer cursor hits; when close, bias toward the front-most orb.
      const depth = orb.dist <= label.dist ? orb.depth : label.depth;
      const score = dist + depth * 20;
      if (score < bestScore) {
        bestScore = score;
        bestKey = entry.key;
      }
    }
    return bestKey;
  }

  function pickIngredient() {
    const maxDist = touchMode.matches ? PICK_RADIUS_TOUCH_PX : PICK_RADIUS_PX;
    const screenHit = nearestIngredient(maxDist);
    if (screenHit) return screenHit;

    raycaster.setFromCamera(pointer, camera);
    const targets = [];
    ingredientMeshes.forEach((entry) => {
      targets.push(entry.hit);
      if (entry.shell) targets.push(entry.shell);
      if (entry.label) targets.push(entry.label);
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

  function hoverIngredient() {
    const maxDist = touchMode.matches ? HOVER_RADIUS_TOUCH_PX : HOVER_RADIUS_PX;
    return nearestIngredient(maxDist);
  }

  function selectIngredient(key) {
    if (!key) return;
    if (key !== lockedKey) {
      lockedKey = key;
      const button = ingredientButtons.find((item) => item.dataset.ingredientKey === key);
      if (button) onIngredientFocus(button);
      setFocusedIngredient(key);
    }
    snapIngredientToFront(key);
  }

  function syncHoverCursor(key) {
    if (isDragging) {
      stage.style.cursor = "grabbing";
      return;
    }
    stage.style.cursor = key ? "pointer" : "grab";
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
    stage.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    updatePointer(event);

    if (activePointerId !== null && event.pointerId === activePointerId) {
      const dx = event.clientX - pointerDownX;
      const dy = event.clientY - pointerDownY;
      if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        isDragging = true;
        dragMoved = true;
        cancelSnap();
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
    const key = hoverIngredient();
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
    stage.releasePointerCapture?.(event.pointerId);

    if (!wasDrag) {
      selectIngredient(pickIngredient());
    }
    syncHoverCursor(hoverIngredient());
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

    syncPageBackground();

    const time = timeMs * 0.001;

    // Snap selected orb to the focus slot; otherwise coast / auto-spin.
    if (snapActive) {
      const t = Math.min(1, (timeMs - snapStartMs) / SNAP_DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      turntableYaw = snapFromYaw + (snapToYaw - snapFromYaw) * eased;
      if (t >= 1) cancelSnap();
    } else if (!isDragging) {
      // Coast after a drag; auto-spin is brisk when idle and eases off on hover
      // so orbs are easy to aim at.
      if (Math.abs(dragVelocity) > 0.0004) {
        turntableYaw += dragVelocity;
        dragVelocity *= 0.94;
      } else {
        dragVelocity = 0;
        // Only freeze when the pointer is tightly over an orb — stage hover
        // no longer throttles the whole turntable.
        if (!hoveredMesh) {
          turntableYaw += 0.0056;
        }
      }
    }

    turntable.rotation.y = turntableYaw;

    ingredientMeshes.forEach((entry) => {
      const reveal = entry.group.userData.targetOpacity ?? 1;
      const delay = entry.group.userData.revealDelay ?? 0;
      const easedReveal = THREE.MathUtils.clamp(reveal - delay, 0, 1);
      const isActive = Boolean(focusedKey && entry.key === focusedKey);
      const dimmed = Boolean(focusedKey && entry.key !== focusedKey);
      entry.group.visible = easedReveal > 0.01;

      const targetScale = isActive ? FOCUS_SCALE : dimmed ? DIM_SCALE : 1;
      const nextScale = THREE.MathUtils.lerp(entry.group.scale.x, targetScale, 0.14);
      entry.group.scale.setScalar(nextScale);

      const shellTarget = easedReveal * (isActive ? 0.78 : dimmed ? 0.14 : 0.5);
      entry.shell.material.opacity = THREE.MathUtils.lerp(
        entry.shell.material.opacity,
        shellTarget,
        0.1
      );
      entry.shell.scale.setScalar(
        THREE.MathUtils.lerp(entry.shell.scale.x, isActive ? 1.08 : 1, 0.12)
      );

      const contentTarget = easedReveal * (isActive ? 1 : dimmed ? 0.28 : 1);
      if (entry.modelRoot) {
        const current = entry.modelRoot.userData.opacity ?? 0;
        const next = THREE.MathUtils.lerp(current, contentTarget, 0.1);
        entry.modelRoot.userData.opacity = next;
        setMeshOpacity(entry.modelRoot, next);
        entry.modelRoot.rotation.y = time * 0.55 + entry.phase;
      } else if (entry.core) {
        entry.core.material.opacity = THREE.MathUtils.lerp(
          entry.core.material.opacity,
          contentTarget,
          0.1
        );
      }

      const labelTarget = easedReveal * (isActive ? 1 : dimmed ? 0.18 : 0.9);
      entry.label.material.opacity = THREE.MathUtils.lerp(
        entry.label.material.opacity,
        labelTarget,
        0.1
      );
      const labelScale = isActive ? 1.22 : dimmed ? 0.9 : 1;
      entry.label.scale.setScalar(
        THREE.MathUtils.lerp(entry.label.scale.x, labelScale, 0.12)
      );
      entry.label.lookAt(camera.position);
    });

    renderer.render(scene, camera);
  }

  async function buildModel() {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const model = gltf.scene;

    // Only strip physics-sim leftovers; materials/textures stay as exported.
    [...model.children].forEach((node) => {
      if (node.name.startsWith("Gummy") && node.position.y > STRAY_GUMMY_MIN_Y) {
        model.remove(node);
      }
    });

    // Bottle mesh has two shells (inner + outer), both transmission:1. Rendering
    // both washes the jar milky; hide the inner mesh entirely. Thin the outer wall
    // so transmission stays clear without lens-warping the gummies / grid.
    model.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      if (materials.every((material) => material.name === "inner")) {
        obj.visible = false;
        return;
      }
      materials.forEach((material) => {
        if (material.name === "inner") {
          material.visible = false;
          return;
        }
        if (!(material.transmission > 0)) return;
        material.thickness = 0.04;
        material.ior = 1.4;
        material.needsUpdate = true;
      });
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = MODEL_TARGET_HEIGHT / size.y;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    bottleGroup.add(model);
    await renderer.compileAsync(model, camera, scene);
  }

  async function loadIngredientSource(loader, button, maxAnisotropy) {
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
  }

  function mountOrb(source, revealIndex) {
    const group = new THREE.Group();
    group.userData.targetOpacity = 1;
    group.userData.revealDelay = revealIndex * 0.08;
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
      new THREE.SphereGeometry(ORB_SHELL_RADIUS, 32, 32),
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

    // Center of each orb sits on the shared orbit ring (local XZ in orbitPivot).
    group.position.set(
      Math.cos(source.angle) * ORBIT_RADIUS,
      0,
      Math.sin(source.angle) * ORBIT_RADIUS
    );
    group.lookAt(0, 0, 0);

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
  }

  async function buildOrbs() {
    const loader = new GLTFLoader();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const buttonByKey = new Map(
      ingredientButtons.map((button) => [button.dataset.ingredientKey, button])
    );

    const orbJobs = INGREDIENT_ORDER.map((key, index) => ({
      key,
      index,
      angle: -Math.PI / 2 + (index / INGREDIENT_ORDER.length) * Math.PI * 2
    })).sort(
      (a, b) => ORB_LOAD_PRIORITY.indexOf(a.key) - ORB_LOAD_PRIORITY.indexOf(b.key)
    );

    let cursor = 0;

    async function loadNextOrb() {
      while (cursor < orbJobs.length) {
        const job = orbJobs[cursor++];
        const button = buttonByKey.get(job.key);
        if (!button) continue;

        try {
          const source = await loadIngredientSource(loader, button, maxAnisotropy);
          mountOrb({ ...source, angle: job.angle }, job.index);
        } catch (err) {
          const modelFile = INGREDIENT_MODELS[job.key];
          console.warn(`[hero-orbit-3d] failed to load ${modelFile || job.key}`, err);
        }
      }
    }

    const workers = Math.min(ORB_LOAD_CONCURRENCY, orbJobs.length);
    await Promise.all(Array.from({ length: workers }, () => loadNextOrb()));
  }

  function startOrbLoading() {
    if (orbsStarted) return;
    orbsStarted = true;
    buildOrbs().catch((err) => {
      console.warn("[hero-orbit-3d] orb loading error", err);
    });
  }

  resize();
  animate(0);

  Promise.all([loadEnvironment(), buildModel()])
    .then(() => {
      stage.classList.add("has-3d");
      section?.classList.add("has-webgl-bg");
    })
    .catch((err) => {
      console.error("[hero-orbit-3d]", err);
      stage.classList.remove("has-3d");
      section?.classList.remove("has-webgl-bg");
      container.classList.add("hero-orbit-3d--failed");
    });

  orbLoadObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      startOrbLoading();
      orbLoadObserver?.disconnect();
      orbLoadObserver = null;
    },
    { rootMargin: ORB_LOAD_VIEWPORT_MARGIN, threshold: 0 }
  );
  orbLoadObserver.observe(container);

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  if (section && section !== container) resizeObserver.observe(section);
  if (stage !== container) resizeObserver.observe(stage);

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

  stage.style.cursor = "grab";
  stage.style.touchAction = "none";
  stage.addEventListener("pointerdown", handlePointerDown);
  stage.addEventListener("pointermove", handlePointerMove);
  stage.addEventListener("pointerup", handlePointerUp);
  stage.addEventListener("pointercancel", handlePointerUp);
  stage.addEventListener("pointerleave", handlePointerLeave);

  return {
    destroy() {
      cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      orbLoadObserver?.disconnect();
      exploreObserver?.disconnect();
      stage.removeEventListener("pointerdown", handlePointerDown);
      stage.removeEventListener("pointermove", handlePointerMove);
      stage.removeEventListener("pointerup", handlePointerUp);
      stage.removeEventListener("pointercancel", handlePointerUp);
      stage.removeEventListener("pointerleave", handlePointerLeave);
      envTexture?.dispose();
      pageBgTexture.dispose();
      pageBackdrop.geometry.dispose();
      pageBackdrop.material.dispose();
      pmrem.dispose();
      renderer.dispose();
      stage.classList.remove("has-3d");
      section?.classList.remove("has-webgl-bg");
    },
    setExploring,
    clearSelection() {
      lockedKey = null;
      cancelSnap();
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
