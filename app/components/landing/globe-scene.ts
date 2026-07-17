import * as THREE from "three";
import type { gsap as GsapType } from "gsap";
import { LANDING_LOCATIONS, type LandingLocation } from "./locations";

const GLOBE_R = 1.12;
const EMBER = 0x8fbf7f; // marka yeşili (landing.css --lp-ember ile aynı)
const GOLD = 0xb4d8a6; // açık yeşil (landing.css --lp-gold ile aynı)
const BONE = 0xefe7d6;
const HS_R = GLOBE_R * 1.028;

function latLonToDir(lat: number, lon: number) {
  const latR = THREE.MathUtils.degToRad(lat);
  const lonR = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(latR) * Math.sin(lonR),
    Math.sin(latR),
    Math.cos(latR) * Math.cos(lonR)
  );
}

function createGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,238,214,1)");
  grd.addColorStop(0.28, "rgba(143,191,127,.85)");
  grd.addColorStop(0.62, "rgba(143,191,127,.16)");
  grd.addColorStop(1, "rgba(143,191,127,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

interface Hotspot {
  loc: LandingLocation;
  dir: THREE.Vector3;
  anchor: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Sprite;
  ring: THREE.Mesh;
  hit: THREE.Mesh;
  phase: number;
  hoverT: number;
  vis: number;
}

export interface GlobeSceneOptions {
  wrap: HTMLElement;
  hero: HTMLElement;
  hotLabel: HTMLElement;
  dimTargets: HTMLElement[];
  gsap: typeof GsapType;
  onFocus: (index: number, viaSwitch: boolean) => void;
  onUnfocus: () => void;
}

export function createGlobeScene(options: GlobeSceneOptions) {
  const { wrap, hero, hotLabel, dimTargets, gsap, onFocus, onUnfocus } =
    options;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    42,
    wrap.clientWidth / wrap.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 3.4);

  const texLoader = new THREE.TextureLoader();
  const earthMap = texLoader.load(
    "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"
  );
  earthMap.colorSpace = THREE.SRGBColorSpace;
  earthMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const globeUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMap: { value: earthMap },
  };

  const globeMaterial = new THREE.ShaderMaterial({
    uniforms: globeUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vView = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec2 uMouse;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec3 tex = texture2D(uMap, vUv).rgb;
        tex = pow(tex, vec3(1.08));
        tex *= vec3(.94, .87, .76);
        vec3 N = normalize(vNormal);
        vec3 V = normalize(-vView);
        float d1 = max(dot(N, normalize(vec3( .55, .85, .55))), 0.);
        float d2 = max(dot(N, normalize(vec3(-.75, -.15, .45))), 0.);
        float d3 = max(dot(N, normalize(vec3( .10, -.80, .30))), 0.);
        float fres = pow(1. - max(dot(N, V), 0.), 2.4);
        vec3 col = tex * (.42 + d1 * .28 + d2 * .14);
        col += vec3(.561, .749, .498) * d1 * .22;
        col += vec3(.706, .847, .651) * d2 * .12;
        col += vec3(.560, .592, .475) * d3 * .08;
        col += vec3(1.0, .93, .82) * fres * .34;
        col += (rand(gl_FragCoord.xy) - .5) * .022;
        col = pow(col, vec3(.94));
        gl_FragColor = vec4(col, 1.);
      }`,
  });

  const atmoMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: globeUniforms.uTime },
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vView = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vec3 N = normalize(vNormal);
        vec3 V = normalize(-vView);
        float rim = pow(1. - max(dot(N, V), 0.), 2.8);
        vec3 col = mix(vec3(.706, .847, .651), vec3(.561, .749, .498), rim);
        gl_FragColor = vec4(col, rim * .42);
      }`,
  });

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R, 72, 72),
    globeMaterial
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.045, 72, 72),
    atmoMaterial
  );
  const group = new THREE.Group();
  group.add(atmosphere);
  group.add(globe);

  const COUNT = 320;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 1.9 + Math.random() * 2.4;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.7;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: GOLD,
      size: 0.022,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  group.add(pts);
  scene.add(group);

  const glowTex = createGlowTexture();
  const hotspots: Hotspot[] = [];

  LANDING_LOCATIONS.forEach((loc, i) => {
    const dir = latLonToDir(loc.lat, loc.lon);
    const anchor = new THREE.Group();
    anchor.position.copy(dir).multiplyScalar(HS_R);
    anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      new THREE.MeshBasicMaterial({ color: EMBER, transparent: true, opacity: 1 })
    );
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xc9e6b8,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.setScalar(0.34);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.056, 0.068, 48),
      new THREE.MeshBasicMaterial({
        color: BONE,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    hit.material.colorWrite = false;
    hit.userData.index = i;

    anchor.add(core, halo, ring, hit);
    group.add(anchor);
    hotspots.push({ loc, dir, anchor, core, halo, ring, hit, phase: i * 1.618, hoverT: 0, vis: 1 });
  });

  const CAM_BASE = new THREE.Vector3(0, 0, 3.4);
  const camDir = new THREE.Vector3(0, 0, 1);
  const lookTarget = new THREE.Vector3();

  function place() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    const wide = w / h > 1.1;
    group.position.x = wide ? (w / h) * 0.42 : 0;
    group.position.y = wide ? 0.05 : 0.55;
    group.scale.setScalar(wide ? 1 : 0.8);
    camDir.copy(CAM_BASE).sub(group.position).normalize();
  }
  place();

  const mouse = new THREE.Vector2(0, 0);
  const eased = new THREE.Vector2(0, 0);
  const ZERO2 = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(10, 10);
  let pointerIn = false;
  let hovered = -1;
  let focused = -1;
  let downXY: [number, number] | null = null;

  const focusState = { dist: 3.4, bias: 0 };
  const qFocus = new THREE.Quaternion();
  const qTarget = new THREE.Quaternion();
  const qSpin = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const spin = { y: 0 };
  const GLOBE_OFFSET = new THREE.Quaternion().setFromUnitVectors(
    latLonToDir(39.5, 32),
    new THREE.Vector3(0, 0, 1)
  );
  group.quaternion.copy(GLOBE_OFFSET);
  let focusTween: gsap.core.Tween | null = null;

  function setNDC(e: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function pick() {
    raycaster.setFromCamera(ndc, camera);
    const pool = hotspots.filter((h) => h.vis > 0.3).map((h) => h.hit);
    const hits = raycaster.intersectObjects(pool, false);
    return hits.length ? (hits[0].object.userData.index as number) : -1;
  }

  function focusLocation(i: number, viaSwitch: boolean) {
    focused = i;
    qFocus.setFromUnitVectors(hotspots[i].dir, camDir);
    if (focusTween) focusTween.kill();
    focusTween = gsap.to(focusState, {
      dist: 2.9,
      bias: 1,
      duration: reduced ? 0.01 : viaSwitch ? 1.25 : 1.7,
      ease: "power3.inOut",
    });
    hero.classList.add("is-focused");
    gsap.to(dimTargets, {
      opacity: 0.07,
      duration: 0.8,
      ease: "power2.out",
      overwrite: "auto",
    });
    const glHint = hero.querySelector(".lp-gl-hint");
    if (glHint) {
      gsap.to(glHint, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    onFocus(i, viaSwitch);
  }

  function unfocus() {
    if (focused < 0) return;
    focused = -1;
    if (focusTween) focusTween.kill();
    focusTween = gsap.to(focusState, {
      dist: 3.4,
      bias: 0,
      duration: reduced ? 0.01 : 1.5,
      ease: "power3.inOut",
    });
    hero.classList.remove("is-focused");
    gsap.to(dimTargets, {
      opacity: 1,
      duration: 0.8,
      ease: "power2.out",
      overwrite: "auto",
    });
    onUnfocus();
  }

  function onPointerMove(e: PointerEvent) {
    pointerIn = true;
    setNDC(e);
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function onPointerLeave() {
    pointerIn = false;
    ndc.set(10, 10);
  }

  function onPointerDown(e: PointerEvent) {
    downXY = [e.clientX, e.clientY];
  }

  function onPointerUp(e: PointerEvent) {
    if (!downXY) return;
    const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
    downXY = null;
    if (moved > 8) return;
    setNDC(e);
    const i = pick();
    if (i > -1) {
      if (i !== focused) focusLocation(i, focused > -1);
    } else if (focused > -1) {
      unfocus();
    }
  }

  function onResize() {
    place();
    if (focused > -1) {
      qFocus.setFromUnitVectors(hotspots[focused].dir, camDir);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") unfocus();
  }

  wrap.addEventListener("pointermove", onPointerMove);
  wrap.addEventListener("pointerleave", onPointerLeave);
  wrap.addEventListener("pointerdown", onPointerDown);
  wrap.addEventListener("pointerup", onPointerUp);
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);

  let visible = true;
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (!visible && focused > -1) unfocus();
    },
    { threshold: 0 }
  );
  observer.observe(hero);

  const clock = new THREE.Clock();
  let t = 0;
  const _wp = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _tc = new THREE.Vector3();
  const _look = new THREE.Vector3();
  let raf = 0;

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    eased.lerp(focused > -1 ? ZERO2 : mouse, 1 - Math.exp(-dt * 2.7));

    if (focused > -1) {
      qTarget.copy(qFocus);
    } else {
      spin.y += dt * 0.08;
      eul.set(eased.y * 0.3, spin.y + eased.x * 0.45, 0);
      qSpin.setFromEuler(eul);
      qTarget.copy(GLOBE_OFFSET).multiply(qSpin);
    }
    group.quaternion.slerp(
      qTarget,
      1 - Math.exp(-dt * (focused > -1 ? 5.2 : 4.2))
    );

    hovered = pointerIn ? pick() : -1;
    wrap.style.cursor = hovered > -1 ? "pointer" : "";

    hotspots.forEach((h, i) => {
      h.anchor.getWorldPosition(_wp);
      _n.copy(_wp).sub(group.position).normalize();
      _tc.copy(camera.position).sub(_wp).normalize();
      const vis = THREE.MathUtils.smoothstep(_n.dot(_tc), -0.05, 0.3);
      h.vis = vis;

      const sel = focused === i;
      const hov = hovered === i && !sel;
      h.hoverT += ((hov ? 1 : 0) - h.hoverT) * (1 - Math.exp(-dt * 9));
      const settle = sel ? 1 - focusState.bias * 0.55 : 1;

      if (sel) {
        h.ring.scale.setScalar(1.15 * settle);
        (h.ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * vis;
        (h.ring.material as THREE.MeshBasicMaterial).color.setHex(BONE);
      } else {
        const p = reduced ? 0.35 : ((t * 0.6 + h.phase) % 1);
        h.ring.scale.setScalar(1 + p * (hov ? 1.4 : 2.0));
        (h.ring.material as THREE.MeshBasicMaterial).opacity =
          (1 - p) * 0.8 * vis;
        (h.ring.material as THREE.MeshBasicMaterial).color.setHex(
          hov ? GOLD : BONE
        );
      }
      h.core.scale.setScalar((1 + h.hoverT * 0.7) * (sel ? 1.8 : 1) * settle);
      (h.core.material as THREE.MeshBasicMaterial).color.setHex(
        sel ? BONE : hov ? GOLD : EMBER
      );
      (h.core.material as THREE.MeshBasicMaterial).opacity = vis;

      const glow =
        reduced ? 0.7 : 0.68 + 0.22 * Math.sin(t * 2.2 + h.phase * 2);
      (h.halo.material as THREE.SpriteMaterial).opacity =
        glow * vis * (sel ? 1.05 : 1);
      h.halo.scale.setScalar(
        0.34 * (1 + h.hoverT * 0.55) * (sel ? 1.15 : 1) * settle
      );
    });

    const parX = eased.x * 0.12 * (1 - focusState.bias);
    const parY = -eased.y * 0.1 * (1 - focusState.bias);
    camera.position.copy(group.position).addScaledVector(camDir, focusState.dist);
    camera.position.x += parX;
    camera.position.y += parY;
    if (focused > -1) {
      hotspots[focused].anchor.getWorldPosition(_look);
      lookTarget.copy(group.position).lerp(_look, focusState.bias * 0.68);
    } else {
      lookTarget.copy(group.position);
    }
    camera.lookAt(lookTarget);

    if (hovered > -1 && focused === -1) {
      const h = hotspots[hovered];
      h.anchor.getWorldPosition(_wp);
      _wp.project(camera);
      const r = wrap.getBoundingClientRect();
      const hr = hero.getBoundingClientRect();
      const x = (_wp.x * 0.5 + 0.5) * r.width + (r.left - hr.left);
      const y = (-_wp.y * 0.5 + 0.5) * r.height + (r.top - hr.top);
      hotLabel.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -165%)`;
      if (hotLabel.textContent !== h.loc.title) {
        hotLabel.textContent = h.loc.title;
      }
      hotLabel.classList.add("show");
    } else {
      hotLabel.classList.remove("show");
    }

    globeUniforms.uTime.value = reduced ? 0 : t;
    globeUniforms.uMouse.value.copy(eased);
    pts.rotation.y = -t * 0.03;
    renderer.render(scene, camera);
  }
  tick();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      if (focusTween) focusTween.kill();
      observer.disconnect();
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      wrap.removeEventListener("pointerdown", onPointerDown);
      wrap.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      renderer.dispose();
      globeMaterial.dispose();
      atmoMaterial.dispose();
      earthMap.dispose();
      glowTex.dispose();
      if (renderer.domElement.parentNode === wrap) {
        wrap.removeChild(renderer.domElement);
      }
    },
    switchTo(i: number) {
      if (focused < 0) {
        focusLocation(i, false);
        return;
      }
      if (i === focused) return;
      focusLocation(i, true);
    },
    unfocus,
    getFocused: () => focused,
  };
}

export type GlobeSceneHandle = ReturnType<typeof createGlobeScene>;
