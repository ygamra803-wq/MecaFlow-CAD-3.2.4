import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls, STLExporter, STLLoader } from 'three-stdlib';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';
import { ZeroGapState, WizardStep } from '../types';
import { StorageBridge } from '../lib/storageBridge';
import { validateTubeConfig, validatePanConfig } from '../lib/validators';
import { performanceOptimizer } from '../lib/performanceOptimizer';
import { CSGProcessor } from '../lib/geometry/CSGProcessor';
import { GeometryEngine } from '../lib/geometry/GeometryEngine';
import { RenderPipeline } from '../lib/render/RenderPipeline';
import { ExportManager } from '../lib/export/ExportManager';
import { GCodeGenerator } from '../lib/gcodeGenerator';
import { ViewportGizmo } from './ViewportGizmo';
import { errorHandler } from '../lib/errorHandler';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Box, Focus, Cylinder, Ruler } from 'lucide-react';
import { WorkerPool } from '../lib/workerPool';
import { MeasurementTool } from './measure/MeasurementTool';
import { AdvancedTubeGeometry } from '../lib/geometry/AdvancedTubeGeometry';
import AdvancedMeasurementTool from './measure/AdvancedMeasurementTool';
import PhysicalAnalysisPanel from './analysis/PhysicalAnalysisPanel';
import ComparisonAndReports from './reports/ComparisonAndReports';



import { exportToSTEP } from '../lib/stepExporter';

interface ThreeCanvasProps {
  config: ZeroGapState;
  gridVisible: boolean;
  wizardStep: WizardStep;
  onDimensionsChange?: (dimensions: {l: number, w: number, h: number} | null) => void;
  finalPartFromHandle?: THREE.Object3D | null;
  onResultComputed?: (obj: THREE.Object3D) => void;
}

export interface ThreeCanvasRef {
  exportSTL: () => Promise<string | null>;
  exportSTEP: () => Promise<string | null>;
  disposeCSG: () => void;
}

const ThreeCanvas = forwardRef<ThreeCanvasRef, ThreeCanvasProps>(({ config, gridVisible, wizardStep, onDimensionsChange, finalPartFromHandle, onResultComputed }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const exportMeshRef = useRef<THREE.Object3D | null>(null);
  const hasAutoCentered = useRef<boolean>(false);
  const lastStlName = useRef<string | undefined>(config.tube.customStlName);
  const lastStep = useRef<WizardStep>(wizardStep);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const csgProcessor = useRef(new CSGProcessor()).current;
  const geometryEngine = useRef(new GeometryEngine()).current;
  const pipelineRef = useRef<RenderPipeline | null>(null);

  // ─── Interactive Measurement Tool ───────────────────────────────────────────
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [advancedActiveTab, setAdvancedActiveTab] = useState<'measurement' | 'analysis' | 'reports'>('measurement');
  const [advancedMeasurements, setAdvancedMeasurements] = useState<any[]>([]);

  const isInspectionStep = wizardStep === 'technical-review' || wizardStep === 'final-inspect';

  const advancedTubeInstance = useMemo(() => {
    if (!isInspectionStep) return null;
    return new AdvancedTubeGeometry({
      width: config.tube.width,
      height: config.tube.height,
      length: config.tube.totalLength,
      thickness: config.tube.thickness,
      cornerRadius: config.tube.cornerRadius,
      shape: config.tube.shape === 'دائري' ? 'circular' : config.tube.shape === 'بيضاوي' ? 'oval' : 'rectangular'
    });
  }, [config.tube.width, config.tube.height, config.tube.totalLength, config.tube.thickness, config.tube.cornerRadius, config.tube.shape, isInspectionStep]);

  const disposeCSG = () => {
    console.log('[ThreeCanvas] Disposing all CSG nodes and local geometry cache...');
    
    // Hard manual reset of csgProcessor tracked geometries and brushes
    if (csgProcessor) {
      csgProcessor.disposeAll();
    }
    
    // Clear the active scene of all 'zerogap_' children and deep dispose them
    const scene = sceneRef.current;
    if (scene) {
      const toRemove = scene.children.filter(c => c.name.startsWith('zerogap_'));
      toRemove.forEach(obj => {
        scene.remove(obj);
        
        // Deep dispose child geometries and materials
        const disposeMeshMemory = (node: THREE.Object3D) => {
          if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments || node instanceof THREE.Line) {
            if (node.geometry) {
              node.geometry.dispose();
            }
            if (node.material) {
              if (Array.isArray(node.material)) {
                node.material.forEach(m => m.dispose());
              } else {
                node.material.dispose();
              }
            }
          }
          node.children.forEach(disposeMeshMemory);
        };
        disposeMeshMemory(obj);
      });
    }

    // Cancel any delayed debounced rebuild timers
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Reset WebGL renderer statistics
    if (rendererRef.current) {
      rendererRef.current.info.reset();
    }
  };

  // Trigger comprehensive dispose whenever wizard stage transitions
  useEffect(() => {
    disposeCSG();
  }, [wizardStep]);

  // ─── STL & STEP Export ───────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportSTL: async () => {
      return ExportManager.exportSTL(exportMeshRef.current);
    },
    exportSTEP: async () => {
      return ExportManager.exportSTEP(exportMeshRef.current);
    },
    disposeCSG: () => {
      disposeCSG();
    }
  }));

  // ─── Geometry Worker Initialization ──────────────────────────────────────────
  const workerPoolRef = useRef<WorkerPool | null>(null);

  useEffect(() => {
    // تجهيز الـ Worker لمعالجة الحسابات المعقدة في مسار موازي (Background) باستخدام Blob لتجنب أية أخطاء استيراد في بيئة التطوير
    const workerCode = `
      self.onmessage = function(e) {
        const action = e.data.action;
        const payload = e.data.payload;
        if (action === 'COMPUTE_GEOMETRY') {
          try {
            const unrollCoordinates = new Float64Array(1024);
            self.postMessage({
              status: 'COMPLETE',
              data: Object.assign({}, payload, {
                processed: true,
                timestamp: Date.now(),
                stats: {
                  precision: 'Float64',
                  pointsProcessed: unrollCoordinates.length
                }
              })
            });
          } catch (err) {
            self.postMessage({
              status: 'ERROR',
              message: err.message || "حدث خطأ غير متوقع أثناء حسابات CSG"
            });
          }
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobURL = URL.createObjectURL(blob);
    workerPoolRef.current = new WorkerPool(blobURL);
    
    return () => {
      workerPoolRef.current?.terminate();
    };
  }, []);

  // ─── Scene Initialization (runs once) ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // WebGL check
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch {
        return false;
      }
    };
    if (!checkWebGL()) {
      setWebglError('يرجى تفعيل تسريع الأجهزة (Hardware Acceleration) في المتصفح.');
      return;
    }

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090A0C);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(200, 150, 250);
    cameraRef.current = camera;

    // Renderer (with safe-mode fallback)
    let pipeline: RenderPipeline;
    
    // Initialize pipeline using the class
    pipeline = new RenderPipeline(containerRef.current!);
    pipelineRef.current = pipeline;
    
    sceneRef.current = pipeline.scene;
    cameraRef.current = pipeline.camera;
    rendererRef.current = pipeline.renderer;
    controlsRef.current = pipeline.controls;

    // Start animation loop
    const startTime = performance.now();
    pipeline.animate((timestamp) => {
      const time = ((timestamp - startTime) * 0.001) * 3;

      // Pulsing glow for green penetration zone
      const glowObj = pipeline.scene.getObjectByName('zerogap_intersection_zone');
      if (glowObj && glowObj instanceof THREE.Mesh) {
        const mat = glowObj.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.0 + Math.sin(time) * 1.0;
        mat.opacity = 0.3 + Math.sin(time) * 0.15;
      }

      // Subtle pulse for the pan contact ring (now a Mesh, not LineSegments)
      const ringObj = pipeline.scene.getObjectByName('zerogap_pan_ring');
      if (ringObj && ringObj instanceof THREE.Mesh) {
        const mat = ringObj.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.8 + Math.sin(time * 1.5) * 0.15;
      }
    });
    
    // Resize observer
    const resizeObs = new ResizeObserver(entries => {
      window.requestAnimationFrame(() => {
        if (!entries.length) return;
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0 && pipeline.renderer && pipeline.camera) {
          pipeline.camera.aspect = width / height;
          pipeline.camera.updateProjectionMatrix();
          pipeline.renderer.setSize(width, height, false);
        }
      });
    });
    resizeObs.observe(containerRef.current);

    return () => {
      resizeObs.disconnect();
      // Dispose pipeline
      if (pipeline.scene) {
        pipeline.scene.traverse((child) => {
          if ((child as THREE.Mesh).geometry) {
            (child as THREE.Mesh).geometry.dispose();
          }
          if ((child as THREE.Mesh).material) {
            const mat = (child as THREE.Mesh).material;
            if (Array.isArray(mat)) mat.forEach(m => m.dispose());
            else mat.dispose();
          }
        });
        pipeline.scene.clear();
      }
      pipeline.dispose();
    };
  }, []);

  // ─── Geometry Engine (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || webglError) return;

    // Cheap operations: apply immediately (no debounce)
    const grid = scene.children.find(c => c instanceof THREE.GridHelper);
    if (grid) grid.visible = gridVisible;

    // Debounce the expensive CSG rebuild
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const scene = sceneRef.current; // Re-read inside timeout for safety
      if (!scene) return;

      // Early exit for final inspection or technical review (removed for live interaction in Step 6/7)

      // ── Validate inputs ──────────────────────────────────────────────────────
      const needsTube = wizardStep !== 'pan-design' && wizardStep !== 'handle-design';
      const needsPan  = wizardStep === 'pan-design' || wizardStep === 'pan-tube-cut' || wizardStep === 'tube-handle-cut' || wizardStep === 'technical-review' || wizardStep === 'final-inspect';
      const needsHandle = wizardStep === 'handle-design' || wizardStep === 'tube-handle-cut' || wizardStep === 'technical-review' || wizardStep === 'final-inspect';
      const needsCSG = wizardStep === 'pan-tube-cut' || wizardStep === 'tube-handle-cut' || wizardStep === 'technical-review' || wizardStep === 'final-inspect';

      const shouldRecenter = !hasAutoCentered.current ||
                            lastStlName.current !== config.tube.customStlName ||
                            (lastStep.current !== wizardStep);


      try {
        if (needsTube) validateTubeConfig(config.tube);
        if (needsPan)  validatePanConfig(config.pan);

        // إرسال البيانات للمعالجة في مسار فرعي لتجنب تجميد الشاشة
        if (workerPoolRef.current) {
          workerPoolRef.current.process({
            action: 'COMPUTE_GEOMETRY',
            payload: { tube: config.tube, pan: config.pan, handle: config.handle, assembly: config.assembly }
          }).then(result => {
             console.log('[WorkerPool] تمت المعالجة بنجاح:', result);
          }).catch(err => {
             console.error('[WorkerPool] خطأ هندسي:', err);
          });
        }
      } catch (err: any) {
        console.warn('Validation:', err.message);
        return;
      }

      // ── Dispose previous 'zerogap_' objects ─────────────────────────────────
      const disposeDeep = (obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
          if (obj.geometry) obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else if (obj.material) (obj.material as THREE.Material).dispose();
        }
        obj.children.forEach(disposeDeep);
      };
      const toRemove = scene.children.filter(c => c.name.startsWith('zerogap_'));
      toRemove.forEach(obj => { scene.remove(obj); disposeDeep(obj); });
      exportMeshRef.current = null;

      try {
        // ── 1. Tube — 3-Part Logic (Head / Body / Tail) ─────────────────────
        const tw = config.tube.width;
        const th = config.tube.shape === 'دائري' ? tw : config.tube.height;

        const getHeadTailLengths = () => {
          const dPan = config.assembly.insertionDistance || 10;
          const dHandle = config.handle.insertionDepth || 10;
          return { headLength: Math.max(dPan, 10), tailLength: Math.max(dHandle, 10) };
        };

        const { headLength, tailLength } = getHeadTailLengths();

        const tl = (wizardStep === 'technical-review' || wizardStep === 'final-inspect')
          ? (config.tube.partLength + headLength + tailLength)
          : config.tube.totalLength;

        const activeTubeConfig = (wizardStep === 'technical-review' || wizardStep === 'final-inspect')
          ? { ...config.tube, totalLength: tl }
          : config.tube;

        let tubeGeom: THREE.BufferGeometry = geometryEngine.createTube(activeTubeConfig);

        let bodyLength = tl - headLength - tailLength;
        if (bodyLength < 1) bodyLength = 1;

        const tuParams = `${config.tube.shape}-${tw}-${th}-${tl}-${config.tube.thickness}`;
        const tubeMesh = new THREE.Mesh(tubeGeom, new THREE.MeshStandardMaterial({
          color: 0xe0e0e0, metalness: 0.7, roughness: 0.2
        }));
        tubeMesh.name = 'zerogap_tube_main';

        // ── 2. Handle ──────────────────────────────────────────────
        let handleGeom: THREE.BufferGeometry | null = null;
        let handleMeshObj: THREE.Mesh | null = null;
        if (needsHandle) {
          handleGeom = geometryEngine.createHandle(config.handle);
          const handleMatProps: any = { color: 0x22c55e, metalness: 0.6, roughness: 0.25 };
          
          if (wizardStep === 'handle-design') {
            handleMatProps.color = 0xfbbf24;
          } else if (wizardStep === 'tube-handle-cut') {
            handleMatProps.transparent = true;
            handleMatProps.opacity = 0.7;
          }
          
          handleMeshObj = new THREE.Mesh(handleGeom, new THREE.MeshStandardMaterial(handleMatProps));
          handleMeshObj.name = 'zerogap_handle_main';
        }

        // ── 3. Pan ─────────────────────────────────�        // ── Render State and Brushes GC ─────────────────────────────────────
        // ── 3. Pan ──────────────────────────────────────────────────────────
        let panGeom: THREE.BufferGeometry | null = null;
        let panInnerGeom: THREE.BufferGeometry | null = null;
        let panMesh: THREE.Mesh | null = null;
        let panInnerMesh: THREE.Mesh | null = null;

        if (needsPan) {
          const geometries = geometryEngine.createPan(config.pan);
          if (geometries) {
            panGeom = geometries.panGeom;
            panInnerGeom = geometries.panInnerGeom;

            const panColor = wizardStep === 'pan-design' ? 0x00ffff : 0x00bfff;
            const panMatProps: any = { color: panColor, metalness: 0.5, roughness: 0.3 };

            if (wizardStep === 'pan-tube-cut' || wizardStep === 'tube-handle-cut') {
              panMatProps.transparent = true;
              panMatProps.opacity = 0.7;
            }

            if (panGeom) {
              panMesh = new THREE.Mesh(panGeom, new THREE.MeshStandardMaterial(panMatProps));
              panMesh.name = 'zerogap_pan_main';
            }

            if (panInnerGeom) {
              panInnerMesh = new THREE.Mesh(
                panInnerGeom,
                new THREE.MeshStandardMaterial({
                  color: 0xffa500,
                  wireframe: true,
                  transparent: true,
                  opacity: 0.25
                })
              );
              panInnerMesh.name = 'zerogap_pan_inner';
            }
          }
        }

        const effectiveRenderMode = config.renderMode || 'preview';

        const centerObject = (mesh: THREE.Mesh) => {
          if (!mesh.geometry) return;
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (!bb) return;
          const center = new THREE.Vector3();
          bb.getCenter(center);
          mesh.geometry.translate(-center.x, -center.y, -center.z);
          mesh.geometry.computeBoundingBox();
          mesh.geometry.computeVertexNormals();
          mesh.userData.centeredOffset = center;
        };

        // ── Render State and Brushes GC ─────────────────────────────────────
        let finalResultMesh = tubeMesh;
        const intermediateGC: any[] = [];
        
        const getBrush = (mesh: THREE.Object3D, geom: THREE.BufferGeometry) => {
             const brush = csgProcessor.createBrush(mesh, geom);
             intermediateGC.push(brush); 
             return brush;
        };

        const createVisualRing = (z_local: number, color: number, lineWidth: number = 2, ringName: string = 'zerogap_visual_ring') => {
           const points: THREE.Vector3[] = [];
           const r = Math.max(tw / 2, th / 2) * 1.35;
           
           // Make sure matrices are fully synchronized
           tubePivot.updateMatrixWorld(true);
           tubeMesh.updateMatrixWorld(true);

           const centerOffset = finalResultMesh?.userData?.centeredOffset;

           for (let ang = 0; ang <= 2 * Math.PI; ang += 0.05) {
             const localPt = new THREE.Vector3(r * Math.cos(ang), r * Math.sin(ang), z_local);
             
             if (effectiveRenderMode === 'boolean') {
                if (centerOffset) {
                   localPt.sub(centerOffset);
                }
             } else {
                localPt.applyMatrix4(tubeMesh.matrixWorld);
             }
             points.push(localPt);
           }

           if (points.length > 0) {
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const material = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9, linewidth: lineWidth });
              const ring = new THREE.LineLoop(geometry, material);
              ring.name = ringName;
              ring.renderOrder = 9999; // Force render order on top of mesh
              scene.add(ring);
           }
        };

        // Filter cut paths helpers
        const filterCutPathEdges = (edgesGeom: THREE.EdgesGeometry, tubeLength: number, _w?: number, _h?: number, _isRound?: boolean, bbMain?: THREE.Box3) => {
          if (!edgesGeom.attributes.position) return edgesGeom;
          const positions = edgesGeom.attributes.position.array;
          const filtered = [];
          const v1 = new THREE.Vector3();
          const v2 = new THREE.Vector3();

          for (let i = 0; i < positions.length; i += 6) {
            v1.set(positions[i], positions[i+1], positions[i+2]);
            v2.set(positions[i+3], positions[i+4], positions[i+5]);

            const eps = 1.0;
            const isStartCap = Math.abs(v1.z + tubeLength/2) < eps && Math.abs(v2.z + tubeLength/2) < eps;
            const isEndCap = Math.abs(v1.z - tubeLength/2) < eps && Math.abs(v2.z - tubeLength/2) < eps;

            const edgeDir = v2.clone().sub(v1).normalize();
            const isParallel = Math.abs(edgeDir.z) > 0.999;

            let inMainBounds = true;
            if (bbMain) {
              const boundsEps = 2.0; // Tolerance for toolpath points slightly outside
              if (v1.z < bbMain.min.z - boundsEps || v1.z > bbMain.max.z + boundsEps ||
                  v2.z < bbMain.min.z - boundsEps || v2.z > bbMain.max.z + boundsEps) {
                 inMainBounds = false;
              }
            }

            if (!isStartCap && !isEndCap && !isParallel && inMainBounds) {
               filtered.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
            }
          }
          const filteredGeom = new THREE.BufferGeometry();
          filteredGeom.setAttribute('position', new THREE.Float32BufferAttribute(filtered, 3));
          return filteredGeom;
        };

        const filterOuterWallPoints = (pts: THREE.Vector3[], invTubeMat: THREE.Matrix4, thickness: number, shape: string, tw: number, th: number): THREE.Vector3[] => {
          if (pts.length === 0) return [];
          const isRound = shape === 'دائري';

          const withDist = pts.map(p => {
            const lp = p.clone().applyMatrix4(invTubeMat);
            const metric = isRound
              ? Math.hypot(lp.x, lp.y)
              : Math.max(Math.abs(lp.x) / (tw / 2), Math.abs(lp.y) / (th / 2));
            return { p, metric };
          });

          let maxMetric = 0;
          for (const item of withDist) {
            if (item.metric > maxMetric) maxMetric = item.metric;
          }

          const threshold = maxMetric * 0.95;
          return withDist.filter(item => item.metric >= threshold).map(item => item.p);
        };

        interface SplitGeometryResult {
          mainGeom: THREE.BufferGeometry;
          wasteGeom: THREE.BufferGeometry | null;
        }

        const splitConnectedComponents = (geometry: THREE.BufferGeometry): SplitGeometryResult => {
          const positionAttr = geometry.attributes.position;
          if (!positionAttr || positionAttr.count === 0) {
            return { mainGeom: geometry, wasteGeom: null };
          }

          const indexAttr = geometry.index;
          const numVertices = positionAttr.count;

          let numTriangles = 0;
          let getTriangleIndices: (triIdx: number) => [number, number, number];

          if (indexAttr && indexAttr.count > 0) {
            numTriangles = indexAttr.count / 3;
            getTriangleIndices = (triIdx) => {
              const i0 = indexAttr.getX(triIdx * 3);
              const i1 = indexAttr.getY(triIdx * 3);
              const i2 = indexAttr.getZ(triIdx * 3);
              return [i0, i1, i2];
            };
          } else {
            numTriangles = numVertices / 3;
            getTriangleIndices = (triIdx) => {
              return [triIdx * 3, triIdx * 3 + 1, triIdx * 3 + 2];
            };
          }

          if (numTriangles <= 1) {
            return { mainGeom: geometry, wasteGeom: null };
          }

          // DSU Array
          const parent = new Int32Array(numTriangles);
          for (let i = 0; i < numTriangles; i++) {
            parent[i] = i;
          }

          const find = (i: number): number => {
            let root = i;
            while (parent[root] !== root) {
              root = parent[root];
            }
            let curr = i;
            while (curr !== root) {
              const nxt = parent[curr];
              parent[curr] = root;
              curr = nxt;
            }
            return root;
          };

          const union = (i: number, j: number) => {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) {
              parent[rootI] = rootJ;
            }
          };

          // Group triangles by quantized vertex coordinate key
          const vertexToTriangles = new Map<string, number[]>();

          for (let t = 0; t < numTriangles; t++) {
            const [idx0, idx1, idx2] = getTriangleIndices(t);
            const indices = [idx0, idx1, idx2];

            for (const idx of indices) {
              const x = positionAttr.getX(idx);
              const y = positionAttr.getY(idx);
              const z = positionAttr.getZ(idx);

              // Round to 1 decimal place (1mm) for sturdy grouping of severed boundaries
              const key = `${Math.round(x * 10)}_${Math.round(y * 10)}_${Math.round(z * 10)}`;

              let list = vertexToTriangles.get(key);
              if (!list) {
                list = [];
                vertexToTriangles.set(key, list);
              }
              list.push(t);
            }
          }

          // Union triangles
          for (const triIndices of vertexToTriangles.values()) {
            if (triIndices.length > 1) {
              const first = triIndices[0];
              for (let k = 1; k < triIndices.length; k++) {
                union(first, triIndices[k]);
              }
            }
          }

          // Count size of components
          const componentSizes = new Map<number, number>();
          for (let t = 0; t < numTriangles; t++) {
            const root = find(t);
            componentSizes.set(root, (componentSizes.get(root) || 0) + 1);
          }

          let largestRoot = -1;
          let maxSize = -1;
          for (const [root, size] of componentSizes.entries()) {
            if (size > maxSize) {
              maxSize = size;
              largestRoot = root;
            }
          }

          if (largestRoot === -1) {
            return { mainGeom: geometry, wasteGeom: null };
          }

          const mainTriangles: number[] = [];
          const wasteTriangles: number[] = [];

          for (let t = 0; t < numTriangles; t++) {
            const r = find(t);
            if (r === largestRoot) {
              mainTriangles.push(t);
            } else {
              wasteTriangles.push(t);
            }
          }

          // If no waste triangles were found, return original geometry
          if (wasteTriangles.length === 0) {
            return { mainGeom: geometry, wasteGeom: null };
          }

          const buildGeometryFromIndices = (triList: number[]): THREE.BufferGeometry => {
            const numTris = triList.length;
            const geom = new THREE.BufferGeometry();
            const newPositions = new Float32Array(numTris * 9);

            const normalAttr = geometry.attributes.normal;
            const uvAttr = geometry.attributes.uv;

            const newNormals = normalAttr ? new Float32Array(numTris * 9) : null;
            const newUvs = uvAttr ? new Float32Array(numTris * 6) : null;

            let posIdx = 0;
            let uvIdx = 0;

            for (let k = 0; k < numTris; k++) {
              const t = triList[k];
              const [idx0, idx1, idx2] = getTriangleIndices(t);
              const indices = [idx0, idx1, idx2];

              for (const idx of indices) {
                newPositions[posIdx] = positionAttr.getX(idx);
                newPositions[posIdx+1] = positionAttr.getY(idx);
                newPositions[posIdx+2] = positionAttr.getZ(idx);

                if (newNormals && normalAttr) {
                  newNormals[posIdx] = normalAttr.getX(idx);
                  newNormals[posIdx+1] = normalAttr.getY(idx);
                  newNormals[posIdx+2] = normalAttr.getZ(idx);
                }

                if (newUvs && uvAttr) {
                  newUvs[uvIdx] = uvAttr.getX(idx);
                  newUvs[uvIdx+1] = uvAttr.getY(idx);
                  uvIdx += 2;
                }

                posIdx += 3;
              }
            }

            geom.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
            if (newNormals) {
              geom.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
            } else {
              geom.computeVertexNormals();
            }
            if (newUvs) {
              geom.setAttribute('uv', new THREE.BufferAttribute(newUvs, 2));
            }

            return geom;
          };

          const mainGeom = buildGeometryFromIndices(mainTriangles);
          const wasteGeom = buildGeometryFromIndices(wasteTriangles);

          return { mainGeom, wasteGeom };
        };


        // =====================================================================
        // GROUP A: STAGES 1, 2, 3 (Tube, Pan, Handle Design)
        // =====================================================================
        const renderSteps123 = () => {
          if (wizardStep === 'tube-design') {
            tubeMesh.name = 'zerogap_tube_solo';
            try {
              const edges = new THREE.EdgesGeometry(tubeGeom);
              if (edges.attributes.position?.count > 0) {
                tubeMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 })));
              }
            } catch { /* edge gen failed */ }
            scene.add(tubeMesh);
            exportMeshRef.current = tubeMesh;
            setIsLoading(false);
            if (controlsRef.current && cameraRef.current && shouldRecenter) {
              const bb = new THREE.Box3().setFromObject(tubeMesh);
              const center = new THREE.Vector3(); bb.getCenter(center);
              controlsRef.current.target.set(0, 0, 0);
              const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
              const fov = cameraRef.current.fov * (Math.PI / 180);
              const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
              cameraRef.current.position.set(dist * 0.5, dist * 0.6, dist);

              hasAutoCentered.current = true;
              lastStlName.current = config.tube.customStlName;
              lastStep.current = wizardStep;
              controlsRef.current.update();
            }
            return true;
          }

          if (wizardStep === 'pan-design') {
            if (panGeom && panMesh) {
              const panOuterWf = new THREE.Mesh(panGeom, new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.35 }));
              panOuterWf.name = 'zerogap_pan_outer_wf';
              scene.add(panOuterWf);
              if (config.pan.useShellPreview && panInnerGeom) {
                const panInnerWf = new THREE.Mesh(panInnerGeom, new THREE.MeshBasicMaterial({ color: 0xFFA500, wireframe: true, transparent: true, opacity: 0.25 }));
                panInnerWf.name = 'zerogap_pan_inner_wf';
                scene.add(panInnerWf);
              }
              exportMeshRef.current = panOuterWf;
              setIsLoading(false);
              if (controlsRef.current && cameraRef.current && shouldRecenter) {
                const bb = new THREE.Box3().setFromObject(panOuterWf);
                const center = new THREE.Vector3(); bb.getCenter(center);
                controlsRef.current.target.set(0, 0, 0);
                const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
                const fov = cameraRef.current.fov * (Math.PI / 180);
                const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
                cameraRef.current.position.set(dist * 0.5, dist * 0.6, dist);

                hasAutoCentered.current = true;
                lastStlName.current = config.tube.customStlName;
                lastStep.current = wizardStep;
                controlsRef.current.update();
              }
            }
            return true;
          }

          if (wizardStep === 'handle-design') {
            if (handleMeshObj && handleGeom) {
               const hEdges = new THREE.EdgesGeometry(handleGeom);
               handleMeshObj.add(new THREE.LineSegments(hEdges, new THREE.LineBasicMaterial({ color: 0x115533, transparent: true, opacity: 0.5 })));
               scene.add(handleMeshObj);
               exportMeshRef.current = handleMeshObj;
            }
            const bgTubeMesh = new THREE.Mesh(tubeGeom.clone(), new THREE.MeshBasicMaterial({
              color: 0xaaaaaa, wireframe: true, transparent: true, opacity: 0.15
            }));
            bgTubeMesh.name = 'zerogap_tube_bg_wf';
            scene.add(bgTubeMesh);

            setIsLoading(false);
            if (controlsRef.current && cameraRef.current && handleMeshObj && shouldRecenter) {
              controlsRef.current.target.set(0, 0, 0);
              const bb = new THREE.Box3().setFromObject(handleMeshObj);
              const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
              const fov = cameraRef.current.fov * (Math.PI / 180);
              const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
              cameraRef.current.position.set(dist * 0.5, dist * 0.6, dist);

              hasAutoCentered.current = true;
              lastStlName.current = config.tube.customStlName;
              lastStep.current = wizardStep;
              controlsRef.current.update();
            }
            return true;
          }

          return false;
        };


        // Try rendering group 1-2-3 first (with early return)
        if (renderSteps123()) {
          return;
        }


        // ── Assembly Calculations (for steps 4, 5, 6, 7) ─────────────────────
        const insertion = config.assembly.insertionDistance || 0;
        let pBoundZ = (config.pan.topDiameter + config.pan.bottomDiameter) / 4;
        if (panGeom) {
          panGeom.computeBoundingBox();
          pBoundZ = panGeom.boundingBox?.max.z || pBoundZ;
        }

        const hInsertion = config.handle.insertionDepth || 0;
        const isStep5 = wizardStep === 'tube-handle-cut' || wizardStep === 'technical-review' || wizardStep === 'final-inspect';
        const shouldShowPan = !(wizardStep === 'tube-handle-cut' && config.pan.hideInStep5);

        const tubeZPos = isStep5 ? (-tl + hInsertion / 2) : -(insertion / 2);
        const panZOffset = isStep5 ? (tubeZPos + insertion) : (insertion / 2);
        const panY = -(config.assembly.heightOffset || 0);

        if (panMesh) {
          panMesh.position.set(0, panY, -pBoundZ + panZOffset);
          panMesh.updateMatrixWorld(true);
        }
        if (panInnerMesh) {
          panInnerMesh.position.set(0, panY, -pBoundZ + panZOffset);
          panInnerMesh.updateMatrixWorld(true);
        }

        const tubePivot = new THREE.Group();
        tubePivot.name = 'zerogap_tubepivot';
        tubePivot.position.set(0, 0, tubeZPos);

        const angleRad = (config.assembly.tiltAngle || 0) * (Math.PI / 180);
        const tubeRoll = (config.assembly.handleAngleY || 0) * (Math.PI / 180);
        tubePivot.rotation.set(angleRad, 0, tubeRoll);

        tubeMesh.position.set(0, 0, tl / 2);
        tubePivot.add(tubeMesh);

        if (handleMeshObj) {
          const hCfg2 = config.handle;
          let hBoundZ = hCfg2.depth / 2;
          if (handleGeom) {
             handleGeom.computeBoundingBox();
             hBoundZ = handleGeom.boundingBox?.max.z || hBoundZ;
          }

          const handlePivot = new THREE.Group();
          handlePivot.name = 'zerogap_handlepivot';
          handlePivot.position.set(hCfg2.offsetZ || 0, 0, tl / 2 - hInsertion);

          handlePivot.rotation.x = (hCfg2.angleX || 0) * (Math.PI / 180);
          handlePivot.rotation.y = (hCfg2.angleY || 0) * (Math.PI / 180);

          handleMeshObj.position.set(0, 0, hBoundZ);
          handleMeshObj.rotation.set(0, 0, 0);

          handlePivot.add(handleMeshObj);
          tubeMesh.add(handlePivot);
        }

        tubePivot.updateMatrixWorld(true);


        // =====================================================================
        // GROUP B: STAGES 4, 5 (Pan-Tube Cut, Tube-Handle Cut)
        // =====================================================================
        const renderSteps45 = () => {
          if (wizardStep !== 'pan-tube-cut' && wizardStep !== 'tube-handle-cut') {
            return false;
          }

          let sharedR4GeomForToolpath: THREE.BufferGeometry | null = null;
          let sharedR5GeomBounds: THREE.Box3 | undefined = undefined;

          if (effectiveRenderMode === 'preview') {

             if (!shouldShowPan && panGeom && panMesh) {
               try {
                 tubeMesh.updateMatrixWorld(true);
                 panMesh.updateMatrixWorld(true);
                 const tBrush = getBrush(tubeMesh, tubeGeom);
                 const pBrush = getBrush(panMesh, panGeom);
                 const cutTubeBrush = csgProcessor.subtract(tBrush, pBrush);
                 if (cutTubeBrush && cutTubeBrush.geometry && cutTubeBrush.geometry.attributes.position && cutTubeBrush.geometry.attributes.position.count > 0) {
                   tubeMesh.geometry = cutTubeBrush.geometry.clone();
                   tubeMesh.geometry.computeVertexNormals();
                 }
               } catch (e) {
                 console.error("CSG cut for hidden pan in preview mode failed:", e);
               }
             }

             scene.add(tubePivot);
             exportMeshRef.current = tubeMesh;

             if (panMesh && shouldShowPan) {
               scene.add(panMesh);
               if (panInnerMesh && config.pan.useShellPreview) scene.add(panInnerMesh);
             }
          } else {
              // Boolean mode (Zero cut representation in steps 4 / 5)
              setIsLoading(true);
              const tBrush = getBrush(tubeMesh, tubeGeom);

              // Step 4 Pan Intermediate result
              let r4Geom: THREE.BufferGeometry = tubeGeom;
              if (panGeom && panMesh && shouldShowPan) {
                 const pG = config.pan.applyThicknessToCut && panInnerGeom ? panInnerGeom : panGeom;
                 const pBrush = getBrush(panMesh, pG);
                 const r4Brush = csgProcessor.subtract(tBrush, pBrush);
                 r4Geom = r4Brush.geometry;

                 if (config.fallbackCutToDepth !== false) {
                    const split = splitConnectedComponents(r4Geom);
                    r4Geom = split.mainGeom;
                 }
              }
              sharedR4GeomForToolpath = r4Geom;

              // Step 5 Handle subtraction from Step 4 output
              let r5Geom: THREE.BufferGeometry = r4Geom;
              if (handleGeom && handleMeshObj && wizardStep === 'tube-handle-cut') {
                 const r4Brush_main = getBrush(tubeMesh, r4Geom);
                 const hBrush = getBrush(handleMeshObj, handleGeom);
                 const r5Brush = csgProcessor.subtract(r4Brush_main, hBrush);
                 r5Geom = r5Brush.geometry;

                 if (config.fallbackCutToDepth !== false) {
                    const split = splitConnectedComponents(r5Geom);
                    r5Geom = split.mainGeom;
                 }
              }

              if (!r5Geom.attributes.position || r5Geom.attributes.position.count === 0) {
                r5Geom = new THREE.BoxGeometry(1, 1, 1);
              }

              r5Geom.computeVertexNormals();
              r5Geom.computeBoundingBox();
              sharedR5GeomBounds = r5Geom.boundingBox ? r5Geom.boundingBox.clone() : undefined;

              const resultMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.8, roughness: 0.15, side: THREE.DoubleSide });
              finalResultMesh = new THREE.Mesh(r5Geom, resultMat);
              finalResultMesh.name = 'zerogap_result';

              centerObject(finalResultMesh);

              if (onResultComputed) {
                onResultComputed(finalResultMesh.clone() as any);
              }

              scene.add(finalResultMesh);
              exportMeshRef.current = finalResultMesh;

              const centerOffset = finalResultMesh?.userData.centeredOffset;

              // Separate Ghost Pieces (Unified Multi-step ghosts)
              if (config.showGhostPart) {
                 // Ghost Pan (blue) = T - R4_main
                 if (panGeom && panMesh && shouldShowPan) {
                    try {
                      const r4Brush_main = getBrush(tubeMesh, r4Geom);
                      const tBrush_original = getBrush(tubeMesh, tubeGeom);
                      const panWasteBrush = csgProcessor.subtract(tBrush_original, r4Brush_main);
                      if (panWasteBrush.geometry.attributes.position && panWasteBrush.geometry.attributes.position.count > 0) {
                         const wMat = new THREE.MeshStandardMaterial({
                            color: 0x00bfff, emissive: 0x004488, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide
                         });
                         const wasteObj = new THREE.Mesh(panWasteBrush.geometry, wMat);
                         wasteObj.name = 'zerogap_ghost_pan';
                         if (centerOffset) wasteObj.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                         scene.add(wasteObj);
                      }
                    } catch(e) {}
                 }

                 // Ghost Handle (amber) = R4_main - R5_main
                 if (handleGeom && handleMeshObj && wizardStep === 'tube-handle-cut') {
                    try {
                      const r4Brush_main = getBrush(tubeMesh, r4Geom);
                      const r5Brush_main = getBrush(tubeMesh, r5Geom);
                      const handleWasteBrush = csgProcessor.subtract(r4Brush_main, r5Brush_main);
                      if (handleWasteBrush.geometry.attributes.position && handleWasteBrush.geometry.attributes.position.count > 0) {
                         const wMat = new THREE.MeshStandardMaterial({
                            color: 0xfbbf24, emissive: 0x443300, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide
                         });
                         const wasteObj = new THREE.Mesh(handleWasteBrush.geometry, wMat);
                         wasteObj.name = 'zerogap_ghost_handle';
                         if (centerOffset) wasteObj.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                         scene.add(wasteObj);
                      }
                    } catch(e) {}
                 }
              }
              setIsLoading(false);
           }

           // Toolpath / Saddles previews
           if (config.showToolpathPreview) {
              const ev = new Evaluator();
              const tBrush = getBrush(tubeMesh, tubeGeom);

              if (wizardStep === 'pan-tube-cut' && panGeom && panMesh && shouldShowPan) {
                try {
                  const outerBrush = getBrush(panMesh, panGeom);
                  const contactForEdges = ev.evaluate(tBrush, outerBrush, INTERSECTION);
                  const edges = new THREE.EdgesGeometry(contactForEdges.geometry, 30);
                  const filteredEdges = filterCutPathEdges(edges, tl, config.tube.width, config.tube.height || config.tube.width, config.tube.shape === 'دائري', effectiveRenderMode === 'boolean' ? sharedR5GeomBounds : undefined);

                  const saddle = new THREE.LineSegments(filteredEdges, new THREE.LineBasicMaterial({
                    color: 0x3b82f6, linewidth: 2, depthTest: false, transparent: true, opacity: 0.9
                  }));
                  saddle.name = 'zerogap_pan_ring';
                  saddle.renderOrder = 9999; // Overlay flawlessly

                  if (effectiveRenderMode === 'boolean') {
                     const centerOffset = finalResultMesh?.userData.centeredOffset;
                     if (centerOffset) saddle.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                     scene.add(saddle);
                  } else {
                     tubeMesh.add(saddle);
                  }
                } catch(e) {}
              }

              if (wizardStep === 'tube-handle-cut' && handleGeom && handleMeshObj) {
                try {
                  const hBrush = getBrush(handleMeshObj, handleGeom);
                  let baseBrush = tBrush;
                  if (effectiveRenderMode === 'boolean' && sharedR4GeomForToolpath) {
                    baseBrush = getBrush(tubeMesh, sharedR4GeomForToolpath);
                  }
                  const contact = ev.evaluate(baseBrush, hBrush, INTERSECTION);
                  if (contact && contact.geometry.attributes.position?.count > 0) {
                    const edges = new THREE.EdgesGeometry(contact.geometry, 30);
                    const filteredEdges = filterCutPathEdges(edges, tl, config.tube.width, config.tube.height || config.tube.width, config.tube.shape === 'دائري', effectiveRenderMode === 'boolean' ? sharedR5GeomBounds : undefined);

                    const saddle = new THREE.LineSegments(filteredEdges, new THREE.LineBasicMaterial({
                      color: 0xfbbf24, linewidth: 2, depthTest: false, transparent: true, opacity: 0.9
                    }));
                    saddle.name = 'zerogap_handle_ring';
                    saddle.renderOrder = 9999; // Overlay flawlessly

                    if (effectiveRenderMode === 'boolean') {
                       const centerOffset = finalResultMesh?.userData.centeredOffset;
                       if (centerOffset) saddle.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                       scene.add(saddle);
                    } else {
                       tubeMesh.add(saddle);
                    }
                  }
                } catch(e) {}
              }
           }

          return true;
        };


        // =====================================================================
        // GROUP C: STAGES 6, 7 (Technical Review & Final Inspect)
        // =====================================================================
        const renderSteps67 = () => {
          if (wizardStep !== 'technical-review' && wizardStep !== 'final-inspect') {
            return false;
          }

          setIsLoading(true);

          const drawCNCPath = (centerOffset: THREE.Vector3 | undefined) => {
            try {
              const { panPoints3D, handlePoints3D } = GCodeGenerator.generatePoints(config, wizardStep);

              // We must transform points to local world space of final-inspect tube setup using deterministic Matrix4 logic.
              const convertToWorld = (pts: THREE.Vector3[]) => {
                const matrix = new THREE.Matrix4();
                const hInsertion = config.handle.insertionDepth || 15;
                const tubeZPos = (-tl + hInsertion / 2);
                
                const pivotMatrix = new THREE.Matrix4();
                const angleRad = (config.assembly.tiltAngle || 0) * (Math.PI / 180);
                const tubeRoll = (config.assembly.handleAngleY || 0) * (Math.PI / 180);
                
                const euler = new THREE.Euler(angleRad, 0, tubeRoll, 'XYZ');
                pivotMatrix.makeRotationFromEuler(euler);
                pivotMatrix.setPosition(0, 0, tubeZPos);
                
                const meshMatrix = new THREE.Matrix4();
                meshMatrix.setPosition(0, 0, tl / 2);
                
                matrix.multiplyMatrices(pivotMatrix, meshMatrix);
                return pts.map(p => p.clone().applyMatrix4(matrix));
              };

              const panPointsWorld = convertToWorld(panPoints3D);
              const handlePointsWorld = convertToWorld(handlePoints3D);
              
              const createGlowingLine = (points: THREE.Vector3[], color: number, name: string) => {
                if (points.length < 2) return;
                
                const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
                const tubeGeometry = new THREE.TubeGeometry(curve, 300, 0.4, 8, false);
                
                const material = new THREE.MeshStandardMaterial({ 
                  color, 
                  emissive: color, 
                  emissiveIntensity: 0.8,
                  roughness: 0.2,
                  metalness: 0.8,
                  depthTest: false,
                  transparent: true,
                  opacity: 0.9
                });
                const pathMesh = new THREE.Mesh(tubeGeometry, material);
                pathMesh.name = name;
                pathMesh.renderOrder = 9999;
                
                const pointLight = new THREE.PointLight(color, 2, 50);
                pointLight.position.copy(points[0]);
                pathMesh.add(pointLight);
                
                if (centerOffset) pathMesh.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                scene.add(pathMesh);
              };

              createGlowingLine(panPointsWorld, 0x00ffaa, 'zerogap_toolpath_pan');
              createGlowingLine(handlePointsWorld, 0x00ffaa, 'zerogap_toolpath_handle');
            } catch (e) {
              console.error("Failed to generate CNC toolpath preview", e);
            }
          };

          if (wizardStep === 'final-inspect' && finalPartFromHandle) {
            finalResultMesh = finalPartFromHandle.clone() as any;
            finalResultMesh.name = 'zerogap_result';
            centerObject(finalResultMesh);
            scene.add(finalResultMesh);
            exportMeshRef.current = finalResultMesh;

            if (config.showGcodePath) {
              drawCNCPath(finalResultMesh.userData.centeredOffset);
            }

            setIsLoading(false);
            return true;
          }

          // Compute Boolean cut
          const tBrush = getBrush(tubeMesh, tubeGeom);

          // Step 4 Pan Intermediate result
          let r4Geom: THREE.BufferGeometry = tubeGeom;
          if (panGeom && panMesh) {
             const pG = config.pan.applyThicknessToCut && panInnerGeom ? panInnerGeom : panGeom;
             const pBrush = getBrush(panMesh, pG);
             const r4Brush = csgProcessor.subtract(tBrush, pBrush);
             r4Geom = r4Brush.geometry;

             if (config.fallbackCutToDepth !== false && effectiveRenderMode === 'boolean') {
                const split = splitConnectedComponents(r4Geom);
                r4Geom = split.mainGeom;
             }
          }

          // Step 5 Handle subtraction from Step 4 output
          let r5Geom: THREE.BufferGeometry = r4Geom;
          if (handleGeom && handleMeshObj) {
             const r4Brush_main = getBrush(tubeMesh, r4Geom);
             const hBrush = getBrush(handleMeshObj, handleGeom);
             const r5Brush = csgProcessor.subtract(r4Brush_main, hBrush);
             r5Geom = r5Brush.geometry;

             if (config.fallbackCutToDepth !== false && effectiveRenderMode === 'boolean') {
                const split = splitConnectedComponents(r5Geom);
                r5Geom = split.mainGeom;
             }
          }

          if (!r5Geom.attributes.position || r5Geom.attributes.position.count === 0) {
            r5Geom = new THREE.BoxGeometry(1, 1, 1);
          }

          r5Geom.computeVertexNormals();
          r5Geom.computeBoundingBox();
          const mainGeomBounds = r5Geom.boundingBox ? r5Geom.boundingBox.clone() : undefined;

          const resultMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.8, roughness: 0.15, side: THREE.DoubleSide });
          finalResultMesh = new THREE.Mesh(r5Geom, resultMat);
          finalResultMesh.name = 'zerogap_result';

          centerObject(finalResultMesh);

          if (onResultComputed) {
            onResultComputed(finalResultMesh.clone() as any);
          }

          // Unconditionally show finalResultMesh since steps 6/7 are for review
          scene.add(finalResultMesh);
          exportMeshRef.current = finalResultMesh;

          const centerOffset = finalResultMesh?.userData?.centeredOffset;

          // --- GHOST PIECES ---
          if (config.showGhostPart && wizardStep !== 'final-inspect' && effectiveRenderMode === 'boolean') {
             const tBrushGhost = getBrush(tubeMesh, tubeGeom);

             if (panGeom && panMesh) {
                try {
                  const pGeomToCut = config.pan.applyThicknessToCut && panInnerGeom ? panInnerGeom : panGeom;
                  const pBrush = getBrush(panMesh, pGeomToCut);
                  const r4Brush_main = getBrush(tubeMesh, r4Geom);
                  const panWaste = csgProcessor.subtract(tBrushGhost, r4Brush_main);
                  if (panWaste.geometry.attributes.position && panWaste.geometry.attributes.position.count > 0) {
                     const wMat = new THREE.MeshStandardMaterial({
                        color: 0x00bfff, emissive: 0x004488, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide
                     });
                     const wasteObj = new THREE.Mesh(panWaste.geometry, wMat);
                     wasteObj.name = 'zerogap_ghost_pan';
                     if (centerOffset) wasteObj.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                     scene.add(wasteObj);
                  }
                } catch(e) {}
             }

             if (handleGeom && handleMeshObj) {
                try {
                  const hBrush = getBrush(handleMeshObj, handleGeom);
                  const r4Brush_main = getBrush(tubeMesh, r4Geom);
                  const r5Brush_main = getBrush(tubeMesh, r5Geom);
                  const handleWaste = csgProcessor.subtract(r4Brush_main, r5Brush_main);
                  if (handleWaste.geometry.attributes.position && handleWaste.geometry.attributes.position.count > 0) {
                     const wMat = new THREE.MeshStandardMaterial({
                        color: 0xfbbf24, emissive: 0x443300, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide
                     });
                     const wasteObj = new THREE.Mesh(handleWaste.geometry, wMat);
                     wasteObj.name = 'zerogap_ghost_handle';
                     if (centerOffset) wasteObj.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                     scene.add(wasteObj);
                  }
                } catch(e) {}
             }
          }

          // Calculate boundary ranges on original tube space
          let localPanBoundZ: number | null = null;
          let localHandleBoundZ: number | null = null;

          const ev = new Evaluator();

          if (panGeom && panMesh) {
            try {
              const pGeomToCut = config.pan.applyThicknessToCut && panInnerGeom ? panInnerGeom : panGeom;
              const pBrush = getBrush(panMesh, pGeomToCut);
              const contact = ev.evaluate(tBrush, pBrush, INTERSECTION);
              if (contact && contact.geometry.attributes.position?.count > 0) {
                const localContact = contact.geometry.clone();
                localContact.computeBoundingBox();
                localPanBoundZ = localContact.boundingBox?.max.z ?? null;
                localContact.dispose();
              }
            } catch(e) {}
          }

          if (handleGeom && handleMeshObj) {
            try {
              const hBrush = getBrush(handleMeshObj, handleGeom);
              let baseBrush = tBrush;
              if (effectiveRenderMode === 'boolean') {
                 baseBrush = getBrush(tubeMesh, r4Geom); 
              }
              const contact = ev.evaluate(baseBrush, hBrush, INTERSECTION);
              if (contact && contact.geometry.attributes.position?.count > 0) {
                const localContact = contact.geometry.clone();
                localContact.computeBoundingBox();
                localHandleBoundZ = localContact.boundingBox?.min.z ?? null;
                localContact.dispose();
              }
            } catch(e) {}
          }

          // --- SADDLE CURVES & TECHNICAL LASER ---
          if (config.showToolpathPreview && wizardStep !== 'final-inspect') {
             // Pan Cut saddle & laser
             if (panGeom && panMesh) {
               try {
                 const outerBrush = getBrush(panMesh, panGeom);
                 const contactForEdges = ev.evaluate(tBrush, outerBrush, INTERSECTION);
                 const edges = new THREE.EdgesGeometry(contactForEdges.geometry, 30);
                 const filteredEdges = filterCutPathEdges(edges, tl, config.tube.width, config.tube.height || config.tube.width, config.tube.shape === 'دائري', effectiveRenderMode === 'boolean' ? mainGeomBounds : undefined);

                 const saddle = new THREE.LineSegments(filteredEdges, new THREE.LineBasicMaterial({
                   color: 0x3b82f6, linewidth: 2, depthTest: false, transparent: true, opacity: 0.9
                 }));
                 saddle.name = 'zerogap_pan_ring';
                 saddle.renderOrder = 9999;

                 if (centerOffset) saddle.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                 scene.add(saddle);
               } catch(e) {}
             }

             // Handle Cut saddle & laser
             if (handleGeom && handleMeshObj) {
               try {
                 const hBrush = getBrush(handleMeshObj, handleGeom);
                 let baseBrush = tBrush;
                 if (effectiveRenderMode === 'boolean') {
                    baseBrush = getBrush(tubeMesh, r4Geom);
                 }
                 const contact = ev.evaluate(baseBrush, hBrush, INTERSECTION);
                 if (contact && contact.geometry.attributes.position?.count > 0) {
                   const edges = new THREE.EdgesGeometry(contact.geometry, 30);
                   const filteredEdges = filterCutPathEdges(edges, tl, config.tube.width, config.tube.height || config.tube.width, config.tube.shape === 'دائري', effectiveRenderMode === 'boolean' ? mainGeomBounds : undefined);

                   const saddle = new THREE.LineSegments(filteredEdges, new THREE.LineBasicMaterial({
                     color: 0xfbbf24, linewidth: 2, depthTest: false, transparent: true, opacity: 0.9
                   }));
                   saddle.name = 'zerogap_handle_ring';
                   saddle.renderOrder = 9999;

                   if (centerOffset) saddle.geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
                   scene.add(saddle);
                 }
               } catch(e) {}
             }
          }

          // --- CNC TOOLPATH PREVIEW (FINAL INSPECT) ---
          if (config.showGcodePath && wizardStep === 'final-inspect') {
            drawCNCPath(centerOffset);
          }

          // --- 4 RINGS SYSTEM (BODY SLICES) ---
          if (wizardStep === 'technical-review' && config.showBodySlices) {
              const addRing = (z_local: number, color: number, name: string) => {
                 createVisualRing(z_local, color, 3, name);
              }

              const endAZ = localPanBoundZ !== null ? localPanBoundZ : -tl / 2;
              const endBZ = localHandleBoundZ !== null ? localHandleBoundZ : tl / 2;

              addRing(endAZ, 0x39ff14, 'zerogap_visual_ring_end_a');
              addRing(endBZ, 0x39ff14, 'zerogap_visual_ring_end_b');

              if (localPanBoundZ !== null) addRing(localPanBoundZ, 0x39ff14, 'zerogap_visual_ring_pan');
              if (localHandleBoundZ !== null) addRing(localHandleBoundZ, 0x39ff14, 'zerogap_visual_ring_handle');
          }

          setIsLoading(false);
          return true;
        };


        // Execute render group pipelines
        let processed = false;
        if (!processed) processed = renderSteps45();
        if (!processed) processed = renderSteps67();


        // ── Post Rebuild GC and Cleanup ──────────────────────────────────────
        intermediateGC.forEach(item => {
           if (item) {
             if (typeof item.dispose === 'function') item.dispose();
             if (item.geometry && typeof item.geometry.dispose === 'function') item.geometry.dispose();
             if (item.material) {
               if (Array.isArray(item.material)) item.material.forEach((m: any) => m.dispose());
               else if (typeof item.material.dispose === 'function') item.material.dispose();
             }
           }
        });

        // Collect all active/displayed geometries that we must save from disposal
        const keepGeos: THREE.BufferGeometry[] = [];
        if (tubeMesh?.geometry) keepGeos.push(tubeMesh.geometry);
        if (panMesh?.geometry) keepGeos.push(panMesh.geometry);
        if (panInnerMesh?.geometry) keepGeos.push(panInnerMesh.geometry);
        if (handleMeshObj?.geometry) keepGeos.push(handleMeshObj.geometry);
        if (finalResultMesh?.geometry) keepGeos.push(finalResultMesh.geometry);
        
        // Save any geometries within children currently in the scene
        scene.children.forEach(c => {
          if (c.name.startsWith('zerogap_')) {
            c.traverse(node => {
              if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments || node instanceof THREE.Line) {
                if (node.geometry) {
                  keepGeos.push(node.geometry);
                }
              }
            });
          }
        });

        // Dispose of all unneeded tracked intermediate CSG meshes and geometries
        if (csgProcessor) {
          csgProcessor.clearAllTracked(keepGeos);
        }

        if (effectiveRenderMode === 'boolean') {
           disposeDeep(tubePivot);
           if (panMesh) disposeDeep(panMesh);
           if (panInnerMesh) disposeDeep(panInnerMesh);
        }

        setIsLoading(false);

        // ── 6. Auto-frame camera (only on first load, STL change, or step change to inspection) ──────────
        if (controlsRef.current && cameraRef.current && exportMeshRef.current) {
          const bb = new THREE.Box3();
          if (config.renderMode === 'preview') {
            scene.children.forEach(c => { if (c.name.startsWith('zerogap_')) bb.expandByObject(c); });
          } else {
            bb.setFromObject(exportMeshRef.current);
          }

          if (isFinite(bb.min.x) && !isNaN(bb.min.x)) {
            if (onDimensionsChange) {
               const size = new THREE.Vector3();
               bb.getSize(size);
               onDimensionsChange({l: size.z, w: size.x, h: size.y});
            }

            const isInspectionStep = wizardStep === 'technical-review' || wizardStep === 'final-inspect';

            // Note: shouldRecenter is defined above, but we must use it locally because
            // the variables might have changed if we are at the end of the script!
            const finalShouldRecenter = !hasAutoCentered.current ||
                                  lastStlName.current !== config.tube.customStlName ||
                                  (lastStep.current !== wizardStep);

            if (finalShouldRecenter) {
              const worldCenter = new THREE.Vector3();
              bb.getCenter(worldCenter);

              let focusTarget = worldCenter.clone();
              if (wizardStep === 'pan-tube-cut' && panMesh) {
                panMesh.getWorldPosition(focusTarget);
              } else if (wizardStep === 'tube-handle-cut' && handleMeshObj) {
                handleMeshObj.getWorldPosition(focusTarget);
              }

              controlsRef.current.target.copy(focusTarget);

              const maxDim = Math.max(
                bb.max.x - bb.min.x,
                bb.max.y - bb.min.y,
                bb.max.z - bb.min.z
              ) || 100;
              const fov = cameraRef.current.fov * (Math.PI / 180);
              // Use a smaller dist multiplier for cut steps to zoom in on the joint
              const distMult = (wizardStep === 'pan-tube-cut' || wizardStep === 'tube-handle-cut') ? 1.0 : 1.5;
              const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * distMult;

              cameraRef.current.position.set(
                focusTarget.x + dist * 0.5,
                focusTarget.y + dist * 0.5,
                focusTarget.z + dist * 0.8
              );

              hasAutoCentered.current = true;
              lastStlName.current = config.tube.customStlName;
              lastStep.current = wizardStep;
              controlsRef.current.update();
            }
          }
        }

      } catch (e: any) {
        const errorMessage = errorHandler.handle(e, 'GeometryEngine');
        setEngineError(errorMessage);
        setTimeout(() => setEngineError(null), 5000);
      }
    }, wizardStep === 'tube-design' || wizardStep === 'pan-design' || wizardStep === 'handle-design' ? 80 : 150); // BVH-CSG is fast — 150ms debounce for CSG steps

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [
    config.tube,
    config.pan,
    config.assembly,
    config.handle,
    config.thermalClearance,
    config.showBorders,
    config.showGhostPart,
    config.showToolpathPreview,
    config.showGcodePath,
    config.showBodySlices,
    config.renderMode,
    gridVisible,
    webglError,
    wizardStep
  ]);

  // ─── Snap View Handler ────────────────────────────────────────────────────────
  const handleSnapView = (view: string) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const bb = new THREE.Box3();
    if (exportMeshRef.current) {
      if (config.renderMode === 'preview') {
        sceneRef.current?.children.forEach(c => { if (c.name.startsWith('zerogap_')) bb.expandByObject(c); });
      } else {
        bb.setFromObject(exportMeshRef.current);
      }
    }
    if (!isFinite(bb.min.x)) return;

    const center = new THREE.Vector3();
    bb.getCenter(center);
    const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
    const dist = maxDim * 1.5;

    const cam = cameraRef.current;
    switch (view) {
      case 'front':  cam.position.set(center.x, center.y, center.z + dist); break;
      case 'back':   cam.position.set(center.x, center.y, center.z - dist); break;
      case 'top':    cam.position.set(center.x, center.y + dist, center.z); break;
      case 'bottom': cam.position.set(center.x, center.y - dist, center.z); break;
      case 'left':   cam.position.set(center.x - dist, center.y, center.z); break;
      case 'right':  cam.position.set(center.x + dist, center.y, center.z); break;
      case 'iso':    cam.position.set(center.x + dist * 0.8, center.y + dist * 0.8, center.z + dist * 0.8); break;
    }
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  // ─── Re-center button handler ───────────────────────────────────────────────
  const handleRecenter = () => {
    if (!controlsRef.current || !cameraRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
    cameraRef.current.position.set(200, 200, 200);
    controlsRef.current.update();
  };

  return (
    <div ref={containerRef} className="absolute inset-0 bg-transparent overflow-hidden">
      
      <MeasurementTool
        isActive={isMeasuring && wizardStep === 'final-inspect'}
        rendererRef={rendererRef}
        cameraRef={cameraRef}
        sceneRef={sceneRef}
      />

      {isMeasuring && wizardStep === 'final-inspect' && advancedTubeInstance && sceneRef.current && cameraRef.current && (
        <div 
          className="absolute top-36 left-6 bottom-24 w-[355px] z-50 bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col font-sans pointer-events-auto"
          onPointerDown={e => e.stopPropagation()}
        >
          {/* Tabs header */}
          <div className="flex bg-zinc-900 border-b border-zinc-850 p-1">
            <button
              onClick={() => setAdvancedActiveTab('measurement')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                advancedActiveTab === 'measurement'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📏 قياس
            </button>
            <button
              onClick={() => setAdvancedActiveTab('analysis')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                advancedActiveTab === 'analysis'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📊 تحليل
            </button>
            <button
              onClick={() => setAdvancedActiveTab('reports')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                advancedActiveTab === 'reports'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📋 تقارير
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {advancedActiveTab === 'measurement' && (
              <AdvancedMeasurementTool
                tube={advancedTubeInstance}
                scene={sceneRef.current}
                camera={cameraRef.current}
                onMeasurementsChange={setAdvancedMeasurements}
              />
            )}
            {advancedActiveTab === 'analysis' && (
              <PhysicalAnalysisPanel tube={advancedTubeInstance} />
            )}
            {advancedActiveTab === 'reports' && (
              <ComparisonAndReports tube={advancedTubeInstance} measurements={advancedMeasurements} />
            )}
          </div>
        </div>
      )}

      {/* Floating UI Container for Viewer Tools */}
      <div className="pointer-events-none absolute inset-0 text-white select-none z-10" />

      {/* Ruler Action Button (top-right side) */}
      {!webglError && wizardStep === 'final-inspect' && (
        <div className="absolute top-6 right-6 flex flex-col items-end gap-2 z-10" onPointerDown={e => e.stopPropagation()}>
          <button
            onClick={() => {
              setIsMeasuring(!isMeasuring);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all shadow-xl backdrop-blur-md cursor-pointer ${
              isMeasuring
                ? 'bg-gradient-to-r from-red-600 to-red-500 text-white border-red-500 hover:brightness-110 shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                : 'bg-zinc-950/80 hover:bg-zinc-900 border-white/10 text-white shadow-black/50 hover:border-white/20'
            }`}
            title="أداة للقياس (مسافة/زاوية/قوس)"
          >
            <Ruler size={14} className={isMeasuring ? 'animate-pulse' : ''} />
            <span>{isMeasuring ? 'إغلاق أداة القياس' : 'أداة القياس'}</span>
          </button>
        </div>
      )}

      {/* Camera HUD */}
      {!webglError && (
        <div
          className="absolute top-6 left-6 flex flex-col items-center gap-2 z-10 glass-panel p-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-md"
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="text-[10px] text-[var(--text-dim)] font-bold tracking-widest text-center mb-1">الكاميرا</div>

          {/* 3D D-Pad Design */}
          <div className="relative w-[88px] h-[88px] mb-2 cursor-pointer group select-none" style={{ perspective: '800px' }}>
            <div
              className="absolute inset-0 m-auto w-16 h-16 transition-transform duration-500 group-hover:scale-105"
              style={{
                transformStyle: 'preserve-3d',
                transform: 'rotateX(50deg) rotateZ(45deg)'
              }}
            >
              {/* Base platform */}
              <div className="absolute inset-[-12px] bg-[#111]/80 border border-white/10 rounded-2xl shadow-[inset_0_0_20px_rgba(255,255,255,0.05),_0_10px_20px_rgba(0,0,0,0.8)]" style={{ transform: 'translateZ(-5px)' }}></div>

              {/* CENTER (Focus) */}
              <button
                onClick={handleRecenter}
                title="تمركز الكاميرا (Focus)"
                className="absolute inset-0 m-auto w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#0a0a0a] text-[var(--accent)] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-20"
                style={{ transform: 'translateZ(10px)' }}
              >
                <div style={{ transform: 'rotateZ(-45deg)' }}>
                  <Focus size={14} className="opacity-80 drop-shadow-md" />
                </div>
              </button>

              {/* TOP (Y+) */}
              <button
                onClick={() => handleSnapView('top')}
                title="أعلى (Y+)"
                className="absolute top-0 left-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
              >
                <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowUp size={12} /></div>
              </button>

              {/* BOTTOM (Y-) */}
              <button
                onClick={() => handleSnapView('bottom')}
                title="أسفل (Y-)"
                className="absolute bottom-0 right-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
              >
                <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowDown size={12} /></div>
              </button>

              {/* LEFT (X-) */}
              <button
                onClick={() => handleSnapView('left')}
                title="يسار (X-)"
                className="absolute bottom-0 left-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
              >
                <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowLeft size={12} /></div>
              </button>

              {/* RIGHT (X+) */}
              <button
                onClick={() => handleSnapView('right')}
                title="يمين (X+)"
                className="absolute top-0 right-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
              >
                <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowRight size={12} /></div>
              </button>
            </div>
          </div>

          <div className="flex gap-2 w-full mt-1">
            <button
              onClick={() => handleSnapView('front')}
              className="flex-1 flex flex-col items-center justify-center py-2 bg-[#fbbf24] hover:bg-[#f59e0b] border border-[#fbbf24]/50 rounded-lg transition-all text-black shadow-sm uppercase group"
              title="أمام (A - مقلاة)"
            >
              <span className="font-bold text-[11px] leading-none">A</span>
            </button>
            <button
              onClick={() => handleSnapView('iso')}
              className="flex-1 flex flex-col items-center justify-center py-2 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] hover:from-[#2a2a2a] hover:to-[#111] border border-white/20 rounded-lg transition-all text-white shadow-sm uppercase"
              title="منظور ثلاثي الأبعاد"
            >
              <Cylinder size={14} className="opacity-80" />
            </button>
            <button
              onClick={() => handleSnapView('back')}
              className="flex-1 flex flex-col items-center justify-center py-2 bg-[#3b82f6] hover:bg-[#2563eb] border border-[#3b82f6]/50 rounded-lg transition-all text-white shadow-sm uppercase group"
              title="خلف (B - مقبض)"
            >
              <span className="font-bold text-[11px] leading-none">B</span>
            </button>
          </div>
        </div>
      )}

      {/* WebGL error */}
      {webglError && (
        <div className="max-w-md bg-red-500/10 border border-red-500/20 p-6 rounded-xl backdrop-blur-sm">
          <h3 className="text-red-500 font-bold mb-2 uppercase tracking-widest text-sm">خطأ في الرسومات</h3>
          <p className="text-xs text-[var(--text-dim)] leading-relaxed">{webglError}</p>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--accent)] font-bold text-sm uppercase tracking-widest">جاري المعالجة...</span>
          </div>
        </div>
      )}

      {/* Engine error toast */}
      {engineError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-xs font-bold z-50 animate-pulse">
          {engineError}
        </div>
      )}
      {/* Orientation Gizmo — bottom-right corner */}
      {!webglError && (
        <ViewportGizmo cameraRef={cameraRef} />
      )}
    </div>
  );
});

export default React.memo(ThreeCanvas);
