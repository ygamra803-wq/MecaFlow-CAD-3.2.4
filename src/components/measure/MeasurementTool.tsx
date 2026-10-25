import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { calculateDistance, calculateAngle, calculateCircumcircle, calculateDeltas } from '../../lib/geometry/measureUtils';

export type MeasurementMode = 'distance' | 'angle' | 'arc' | 'auto';

interface MeasurementToolProps {
  isActive: boolean;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  sceneRef: React.RefObject<THREE.Scene | null>;
  mode?: MeasurementMode;
  onClose?: () => void;
}

export const MeasurementTool: React.FC<MeasurementToolProps> = ({
  isActive,
  rendererRef,
  cameraRef,
  sceneRef,
  mode = 'auto',
  onClose
}) => {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Constants
  const MAX_POINTS = mode === 'distance' ? 2 : 3;

  // Pointer interaction
  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas || !isActive) {
      if (!isActive) setPoints([]); // Reset when turned off
      return;
    }

    let pointerDownX = 0;
    let pointerDownY = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownX;
      const dy = e.clientY - pointerDownY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Click threshold
      if (dist < 5) {
        if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;
        
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        const targets = sceneRef.current.children.filter(c => c instanceof THREE.Mesh && !c.name.includes('measurement') && c.visible);
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
          const hitPoint = intersects[0].point;
          setPoints(prev => {
            const nextPoints = [...prev];
            if (nextPoints.length >= MAX_POINTS) {
              return [hitPoint]; // restart
            }
            return [...nextPoints, hitPoint];
          });
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [isActive, rendererRef, cameraRef, sceneRef, MAX_POINTS]);

  // 3D Rendering of markers and lines
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Cleanup old measurement group
    if (measurementGroupRef.current) {
      scene.remove(measurementGroupRef.current);
      measurementGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      measurementGroupRef.current = null;
    }

    if (!isActive || points.length === 0) return;

    const group = new THREE.Group();
    group.name = 'custom_measurement_group';
    measurementGroupRef.current = group;
    scene.add(group);

    const colors = [0xfbbf24, 0x3b82f6, 0xec4899]; // yellow, blue, pink

    // Draw markers
    points.forEach((p, idx) => {
      const markerGeo = new THREE.SphereGeometry(1.5, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: colors[idx], depthTest: false, depthWrite: false });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(p);
      marker.renderOrder = 999;
      group.add(marker);
    });

    // Draw lines depending on points
    if (points.length >= 2) {
      const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3, depthTest: false, depthWrite: false });
      
      // Line from P1 to P2
      const lineGeo1 = new THREE.BufferGeometry().setFromPoints([points[0], points[1]]);
      const line1 = new THREE.Line(lineGeo1, lineMat);
      line1.renderOrder = 998;
      group.add(line1);

      // Line from P2 to P3
      if (points.length === 3) {
        if (mode === 'angle' || mode === 'auto') {
          // In angle mode, point 2 is vertex, so we draw from p2 to p3
          const lineGeo2 = new THREE.BufferGeometry().setFromPoints([points[1], points[2]]);
          const line2 = new THREE.Line(lineGeo2, lineMat);
          line2.renderOrder = 998;
          group.add(line2);
        }

        if (mode === 'arc' || mode === 'auto') {
          // Draw arc if circumcircle exists
          const circle = calculateCircumcircle(points[0], points[1], points[2]);
          if (circle) {
             // Create an arc visualizer
             const curve = new THREE.EllipseCurve(
               0, 0,
               circle.radius, circle.radius,
               0, 2 * Math.PI,
               false,
               0
             );
             const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
             // We need to orient this geometry to the exact plane formed by ABC
             const arcMat = new THREE.LineBasicMaterial({ color: 0xec4899, depthTest: false, depthWrite: false, opacity: 0.5, transparent: true });
             const arcLine = new THREE.Line(arcGeo, arcMat);
             
             // Orient the arc object
             const v1 = new THREE.Vector3().subVectors(points[0], points[1]).normalize();
             const v2 = new THREE.Vector3().subVectors(points[2], points[1]).normalize();
             const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
             
             // The arc is drawn in XY plane. We want its normal (Z) to align with our calculated normal
             arcLine.position.copy(circle.center);
             const targetUp = new THREE.Vector3(0, 0, 1);
             const quaternion = new THREE.Quaternion().setFromUnitVectors(targetUp, normal);
             arcLine.setRotationFromQuaternion(quaternion);
             arcLine.renderOrder = 997;
             group.add(arcLine);
          }
        }
      }
    }

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

  }, [points, isActive, mode, sceneRef, rendererRef, cameraRef]);


  // Floating Labels UI Overlay
  const [labels, setLabels] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    let animationFrameId = 0;
    
    const updateLabels = () => {
      animationFrameId = requestAnimationFrame(updateLabels);
      
      if (!isActive || points.length === 0 || !cameraRef.current || !rendererRef.current) {
        setLabels([]);
        return;
      }

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const cam = cameraRef.current;

      const project = (v: THREE.Vector3) => {
        const tempV = v.clone().project(cam);
        if (tempV.z > 1) return null; // Behind camera
        return {
          x: (tempV.x * 0.5 + 0.5) * rect.width,
          y: (tempV.y * -0.5 + 0.5) * rect.height
        };
      };

      const newLabels: React.ReactNode[] = [];
      const colors = ['bg-amber-500 text-black', 'bg-blue-500 text-white', 'bg-pink-500 text-white'];

      // Points labels
      points.forEach((p, idx) => {
        const screen = project(p);
        if (screen) {
          newLabels.push(
            <div key={`p-${idx}`} className={`absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-black border border-white/20 shadow-md ${colors[idx]}`} style={{ left: screen.x, top: screen.y }}>
              {idx + 1}
            </div>
          );
        }
      });

      // Data Panels
      if (points.length >= 2) {
        // Distance Panel
        const dist = calculateDistance(points[0], points[1]);
        const midPoint = new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5);
        const screenMid = project(midPoint);
        const deltas = calculateDeltas(points[0], points[1]);

        if (screenMid) {
          newLabels.push(
            <div key="dist-panel" className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 bg-zinc-950/95 text-white border border-green-500/40 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col items-center gap-1 backdrop-blur-md" style={{ left: screenMid.x, top: screenMid.y }}>
               <div className="text-[#10b981] font-black text-xs">{dist.toFixed(2)} ملم</div>
               <div className="text-[8px] text-zinc-400 font-mono flex gap-2">
                 <span>ΔX: {deltas.dx.toFixed(1)}</span>
                 <span>ΔY: {deltas.dy.toFixed(1)}</span>
                 <span>ΔZ: {deltas.dz.toFixed(1)}</span>
               </div>
            </div>
          );
        }
      }

      if (points.length === 3) {
        const dist23 = calculateDistance(points[1], points[2]);
        const midPoint23 = new THREE.Vector3().addVectors(points[1], points[2]).multiplyScalar(0.5);
        const screenMid23 = project(midPoint23);
        
        if (screenMid23) {
            newLabels.push(
              <div key="dist2-panel" className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 bg-zinc-950/95 text-white border border-green-500/40 px-3 py-1 rounded-xl text-[9px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur-md" style={{ left: screenMid23.x, top: screenMid23.y }}>
                 <div className="text-[#10b981] text-[10px]">{dist23.toFixed(2)} ملم</div>
              </div>
            );
        }

        // Angle Panel at Vertex (P2)
        const angle = calculateAngle(points[0], points[1], points[2]);
        const screenVert = project(points[1]); // At vertex
        if (screenVert) {
          newLabels.push(
            <div key="angle-panel" className="absolute pointer-events-none transform -translate-x-1/2 translate-y-4 bg-blue-950/95 text-blue-200 border border-blue-500/40 px-3 py-1 rounded-lg text-[10px] font-bold shadow-md flex items-center gap-2 backdrop-blur-md" style={{ left: screenVert.x, top: screenVert.y }}>
               <span>الزاوية:</span>
               <span className="text-white text-xs">{angle.toFixed(1)}°</span>
            </div>
          );
        }

        // Arc Radius Panel at Circumcenter
        const circle = calculateCircumcircle(points[0], points[1], points[2]);
        if (circle) {
          const screenCenter = project(circle.center);
          if (screenCenter) {
             newLabels.push(
               <div key="arc-panel" className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 bg-pink-950/95 text-pink-200 border border-pink-500/40 px-3 py-1 rounded-lg text-[10px] font-bold shadow-md flex items-center gap-2 backdrop-blur-md" style={{ left: screenCenter.x, top: screenCenter.y }}>
                 <span>قطر القوس:</span>
                 <span className="text-white text-xs">{(circle.radius * 2).toFixed(2)} ملم</span>
               </div>
             );
          }
        }
      }

      setLabels(newLabels);
    };

    updateLabels();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, points, cameraRef, rendererRef]);


  if (!isActive) return null;

  return (
    <>
      <div 
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-[100] overflow-hidden"
      >
        {labels}
      </div>

      <div className="absolute top-20 right-6 z-[101] bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-2xl w-64 backdrop-blur-md text-zinc-100 flex flex-col gap-3 font-sans">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-emerald-400">بيانات القياس الشاملة</h3>
          <button onClick={() => setPoints([])} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded">إعادة ضبط</button>
        </div>
        
        <div className="text-[10px] text-zinc-400 leading-relaxed border-b border-zinc-800 pb-2">
          {points.length === 0 && 'انقر على النموذج لتحديد النقطة الأولى.'}
          {points.length === 1 && 'انقر لاختيار النقطة الثانية (قياس المسافة).'}
          {points.length === 2 && 'المسافة محسوبة. انقر لنقطة ثالثة (الزاوية/القوس).'}
          {points.length === 3 && 'اكتملت بيانات 3 نقاط (مسافة، زاوية، وتحدب قوس).'}
        </div>

        <div className="flex flex-col gap-1 text-[11px] font-mono">
          {points[0] && <div>P1: ({points[0].x.toFixed(1)}, {points[0].y.toFixed(1)}, {points[0].z.toFixed(1)})</div>}
          {points[1] && <div>P2: ({points[1].x.toFixed(1)}, {points[1].y.toFixed(1)}, {points[1].z.toFixed(1)})</div>}
          {points[2] && <div>P3: ({points[2].x.toFixed(1)}, {points[2].y.toFixed(1)}, {points[2].z.toFixed(1)})</div>}
        </div>
      </div>
    </>
  );
};
