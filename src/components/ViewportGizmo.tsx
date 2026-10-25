/**
 * ViewportGizmo – orientation cube in the corner of the 3D viewport.
 * Shows A-end (Pan/مقلاة) and B-end (Handle/مقبض) clearly.
 * Syncs rotation with the main scene camera.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ViewportGizmoProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
}

const SIZE = 96; // matches D-Pad 24 * 4px = 96px

// Face definitions for orientation cube
const FACES: { dir: THREE.Vector3; label: string; color: string; labelColor: string }[] = [
  { dir: new THREE.Vector3( 0,  0,  1), label: 'A', color: '#fbbf24', labelColor: '#000000' }, // Yellow Background (A - Pan)
  { dir: new THREE.Vector3( 0,  0, -1), label: 'B', color: '#3b82f6', labelColor: '#ffffff' }, // Blue Background (B - Handle)
  { dir: new THREE.Vector3( 0,  1,  0), label: 'C', color: '#111111', labelColor: '#10b981' }, 
  { dir: new THREE.Vector3( 0, -1,  0), label: 'D', color: '#111111', labelColor: '#10b981' }, 
  { dir: new THREE.Vector3( 1,  0,  0), label: 'E', color: '#111111', labelColor: '#10b981' }, 
  { dir: new THREE.Vector3(-1,  0,  0), label: 'F', color: '#111111', labelColor: '#10b981' }, 
];

// Create a canvas texture with text for a cube face
function makeTextTexture(text: string, bgColor: string, textColor: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  
  // Inner metallic gradient for non-A/B faces
  if (bgColor === '#111111') {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#222222');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(4, 4, size - 8, size - 8);
  }

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  // Text
  ctx.fillStyle = textColor;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const ViewportGizmo: React.FC<ViewportGizmoProps> = ({ cameraRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gizmoCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Mini renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(SIZE, SIZE);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.classList.add('absolute', 'inset-0');
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("ViewportGizmo: WebGL context could not be created", e);
      return;
    }

    // Mini scene
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirL = new THREE.DirectionalLight(0xffffff, 0.5);
    dirL.position.set(2, 3, 2);
    scene.add(dirL);

    // Mini camera
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.set(0, 0, 3.5);
    gizmoCameraRef.current = cam;

    // Build cube with textured faces
    // THREE.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
    const faceMap = [
      FACES[4], // +X
      FACES[5], // -X
      FACES[2], // +Y (فوق)
      FACES[3], // -Y (تحت)
      FACES[0], // +Z (A - مقلاة)
      FACES[1], // -Z (B - مقبض)
    ];

    const materials = faceMap.map(f =>
      new THREE.MeshStandardMaterial({
        map: makeTextTexture(f.label, f.color, f.labelColor),
        roughness: 0.5,
        metalness: 0.1,
      })
    );

    const cubeGeom = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const cubeMesh = new THREE.Mesh(cubeGeom, materials);
    scene.add(cubeMesh);

    // Edge wireframe for clarity
    const edges = new THREE.EdgesGeometry(cubeGeom);
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
    cubeMesh.add(edgeLine);

    // Animate: sync rotation with main camera
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const mainCam = cameraRef.current;
      if (mainCam && gizmoCameraRef.current) {
        const q = mainCam.quaternion.clone();
        gizmoCameraRef.current.position.set(0, 0, 3.5).applyQuaternion(q);
        gizmoCameraRef.current.lookAt(0, 0, 0);
      }
      renderer.render(scene, cam);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        rendererRef.current = null;
      }
      materials.forEach(m => { m.map?.dispose(); m.dispose(); });
      cubeGeom.dispose();
      edges.dispose();
    };
  }, [cameraRef]);

  return (
    <div
      className="absolute bottom-6 right-6 flex flex-col items-center gap-2 z-20 glass-panel p-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-md select-none"
      title="مكعب التوجيه — A = المقلاة (أمام)، B = المقبض (خلف)"
    >
      <div className="text-[10px] text-[var(--text-dim)] font-bold tracking-widest text-center mb-1">المنظور</div>
      
      <div 
        ref={containerRef}
        className="relative w-24 h-24 bg-black/40 rounded-full flex items-center justify-center border border-white/5 shadow-inner overflow-hidden"
      >
      </div>

      <div className="flex gap-2 text-[8px] font-bold font-mono mt-1 px-2 py-1 bg-white/5 rounded-xl border border-white/5">
        <span className="text-[#ffff00]">A مقلاة</span>
        <span className="text-[#00aaff]">B مقبض</span>
      </div>
    </div>
  );
};

export default ViewportGizmo;
