import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { TankCustomization, TeamId } from '../../shared/types';
import { createTankVisualRig, type TankVisualRig } from '../game/tankMesh';

interface TankPreviewCanvasProps {
  custom: TankCustomization;
  team?: TeamId;
  colorblindTeams?: boolean;
  interactive?: boolean;
  winPose?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

function isSoftwareWebGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const TankPreviewCanvas: React.FC<TankPreviewCanvasProps> = ({
  custom,
  team = 'none',
  colorblindTeams = false,
  interactive = true,
  winPose = false,
  reducedMotion = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<TankVisualRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Store latest props for animation loop
  const optsRef = useRef({ winPose, reducedMotion });
  optsRef.current = { winPose, reducedMotion };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const soft = isSoftwareWebGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !soft, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(soft ? 1 : Math.min(window.devicePixelRatio || 1, 2));

    const rect = container.getBoundingClientRect();
    const w = Math.max(220, rect.width || 360);
    const h = Math.max(180, rect.height || 260);
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.2, 50);
    let yaw = 0.62;
    let pitch = 0.42;
    let dist = 5.4;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfffbeb, 1.7);
    key.position.set(4, 7, 5);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x00e5c3, 1.1);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    // Pedestal turntable disc
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.35, 0.24, 32),
      new THREE.MeshStandardMaterial({ color: 0x18234e, roughness: 0.35, metalness: 0.6 })
    );
    pedestal.position.y = -0.14;
    scene.add(pedestal);

    const neonRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.18, 0.04, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x00e5c3 })
    );
    neonRing.rotation.x = Math.PI / 2;
    neonRing.position.y = -0.02;
    scene.add(neonRing);

    const rig = createTankVisualRig(custom, team, colorblindTeams);
    scene.add(rig.root);
    rigRef.current = rig;

    // Drag rotate & wheel zoom
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      if (!interactive) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.012;
      pitch = Math.max(0.18, Math.min(0.95, pitch + dy * 0.008));
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (!interactive) return;
      e.preventDefault();
      dist = Math.max(3.8, Math.min(7.5, dist + e.deltaY * 0.004));
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      const nw = Math.max(200, r.width);
      const nh = Math.max(160, r.height);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(container);

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let spinAngle = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 120);
        }
      };
      frameId = window.setTimeout(poll, 8);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!dragging && !optsRef.current.reducedMotion) {
        spinAngle += dt * (optsRef.current.winPose ? 0.9 : 0.42);
      }

      const activeRig = rigRef.current;
      if (activeRig) {
        activeRig.root.rotation.y = spinAngle;
        activeRig.turretPivot.rotation.y = Math.sin(now * 0.0012) * 0.35;
        if (optsRef.current.winPose) {
          activeRig.root.position.y = Math.abs(Math.sin(now * 0.004)) * 0.14;
        } else {
          activeRig.root.position.y = 0;
        }
      }

      const effDist = dist / Math.max(0.68, Math.min(1, camera.aspect));
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * effDist,
        Math.sin(pitch) * effDist + 0.55,
        Math.cos(yaw) * Math.cos(pitch) * effDist
      );
      camera.lookAt(0, 0.55, 0);
      renderer.render(scene, camera);

      if (soft) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (soft) {
      frameId = window.setTimeout(tick, 20);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (dom.parentNode === container) container.removeChild(dom);
    };
  }, [interactive]);

  // Swap tank mesh whenever customization/team updates without recreating WebGL context
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) {
      scene.remove(rigRef.current.root);
    }
    const nextRig = createTankVisualRig(custom, team, colorblindTeams);
    scene.add(nextRig.root);
    rigRef.current = nextRig;
  }, [custom.classId, custom.colorId, custom.turretStyle, custom.decal, team, colorblindTeams]);

  if (webglFailed) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-black/25 border border-white/10 ${className}`}>
        <span className="font-display text-sm text-[#AAB3DE]">3D Preview Unavailable</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      aria-label="3D Tank Preview"
    />
  );
};
