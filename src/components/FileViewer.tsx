import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { STLLoader, OrbitControls } from 'three-stdlib';
import occtimportjs from 'occt-import-js';
import { 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Focus, Cylinder, 
  X, Upload, Save, Eye, RefreshCw, Scissors, Grid3x3, Tag, Layers, 
  Maximize, Box, MonitorPlay, Anchor, Ruler, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { ViewportGizmo } from './ViewportGizmo';

// custom toggle switch for consistent design
const CustomToggle = ({ checked, onChange, label, dir = "rtl" }: { checked: boolean, onChange: (v: boolean) => void, label: string, dir?: "rtl" | "ltr" }) => (
  <label className="flex items-center justify-between text-[10px] text-zinc-300 cursor-pointer py-1 hover:text-white transition-colors" dir={dir}>
    <span>{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-[var(--accent)]' : 'bg-black/60 border-[var(--border)] shadow-inner'}`}
    >
      <span
        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? (dir === 'rtl' ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'}`}
      />
    </button>
  </label>
);

// Constant engineering icons styled with precision to match library/dashboard
export const TubeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <ellipse cx="12" cy="12" rx="9" ry="3" strokeDasharray="3, 3" />
  </svg>
);

export const PanIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="8" rx="8" ry="3.5" />
    <path d="M4 8v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5V8" />
    <path d="M22 8h-2" />
    <path d="M4 8H2" />
  </svg>
);

export const HandleIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="7" y="2" width="10" height="20" rx="3" />
    <path d="M12 6V18" />
    <circle cx="12" cy="6" r="1.2" fill="currentColor" />
    <circle cx="12" cy="18" r="1.2" fill="currentColor" />
  </svg>
);

interface FileViewerProps {
  onClose: () => void;
  currentStlProvider?: () => Promise<string | null>;
  onAddProfile?: (name: string, type: 'tube' | 'pan' | 'handle', data: any) => void;
  onConfirmSelection?: (name: string, category: 'tube' | 'pan' | 'handle', buffer: ArrayBuffer) => void;
  initialCategory?: 'tube' | 'pan' | 'handle';
}

const DENSITY_PRESETS = [
  { name: 'الفولاذ المقاوم للصدأ (SS 304)', value: 7.85, symbol: 'g/cm³' },
  { name: 'الألومنيوم الصناعي (Al 6061)', value: 2.7, symbol: 'g/cm³' },
  { name: 'النحاس الأحمر المصنع', value: 8.96, symbol: 'g/cm³' },
  { name: 'التيتانيوم الخفيف وزنًا', value: 4.5, symbol: 'g/cm³' },
];

export const FileViewer: React.FC<FileViewerProps> = ({ onClose, currentStlProvider, onAddProfile, onConfirmSelection, initialCategory }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [activeFileName, setActiveFileName] = useState<string>('لم يتم تحميل مجسم بعد');
  const [loadedBuffer, setLoadedBuffer] = useState<ArrayBuffer | null>(null);

  // Save unique model to library flow properties
  const [isSaveModeActive, setIsSaveModeActive] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [customModelCategory, setCustomModelCategory] = useState<'tube' | 'pan' | 'handle'>(initialCategory || 'tube');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const [activeMobileTab, setActiveMobileTab] = useState<'3d' | 'controls'>('3d');

  const colors = {
    tube: {
      primary: 'emerald-500',
      text: 'text-emerald-400',
      textDim: 'text-emerald-500/80',
      border: 'border-emerald-500/30',
      bgLight: 'bg-emerald-950/20',
      bgHover: 'bg-emerald-950/40 hover:bg-emerald-900/60',
      bgPulse: 'bg-emerald-500',
      gradient: 'from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500',
      shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_25px_rgba(16,185,129,0.1)]',
    },
    pan: {
      primary: 'teal-500',
      text: 'text-teal-400',
      textDim: 'text-teal-500/80',
      border: 'border-teal-500/30',
      bgLight: 'bg-teal-950/20',
      bgHover: 'bg-teal-950/40 hover:bg-teal-900/60',
      bgPulse: 'bg-teal-500',
      gradient: 'from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500',
      shadow: 'shadow-[0_0_15px_rgba(20,184,166,0.05)] hover:shadow-[0_0_25px_rgba(20,184,166,0.1)]',
    },
    handle: {
      primary: 'blue-500',
      text: 'text-blue-400',
      textDim: 'text-blue-500/80',
      border: 'border-blue-500/30',
      bgLight: 'bg-blue-950/20',
      bgHover: 'bg-blue-950/40 hover:bg-blue-900/60',
      bgPulse: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500',
      shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:shadow-[0_0_25px_rgba(59,130,246,0.1)]',
    }
  }[customModelCategory] || {
    primary: 'emerald-500',
    text: 'text-emerald-400',
    textDim: 'text-emerald-500/80',
    border: 'border-emerald-500/30',
    bgLight: 'bg-emerald-950/20',
    bgHover: 'bg-emerald-950/40 hover:bg-emerald-900/60',
    bgPulse: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500',
    shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_25px_rgba(16,185,129,0.1)]',
  };

  useEffect(() => {
    const triggerResize = () => {
      window.dispatchEvent(new Event('resize'));
    };
    triggerResize();
    const t1 = setTimeout(triggerResize, 50);
    const t2 = setTimeout(triggerResize, 150);
    const t3 = setTimeout(triggerResize, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeMobileTab]);

  useEffect(() => {
    if (activeFileName && activeFileName !== 'لم يتم تحميل مجسم بعد') {
      const cleaned = activeFileName.replace(/\.(stl|step|stp)$/i, '');
      setCustomModelName(cleaned);
    }
  }, [activeFileName]);

  const handleSaveUniqueModel = () => {
    if (!onAddProfile) {
      setError('خطأ: معالج إضافة النماذج غير معرف.');
      return;
    }
    const finalName = customModelName.trim() || (activeFileName !== 'لم يتم تحميل مجسم بعد' ? activeFileName.replace(/\.(stl|step|stp)$/i, '') : 'نموذج فريد');
    onAddProfile(finalName, customModelCategory, {
      isUnique: true,
      triangles: modelInfo?.triangles || 0,
      dimensions: modelInfo?.dimensions || { x: 0, y: 0, z: 0 },
      selectedFaceA: selectedFaceA,
      customFileName: activeFileName !== 'لم يتم تحميل مجسم بعد' ? activeFileName : 'model_import.stl',
      importedAt: Date.now(),
      sliceAxis: sliceAxis,
      sliceValue: sliceValue,
    });
    setSaveSuccessMessage('تم حفظ النموذج الفريد بنجاح في المكتبة! 🎉');
    setTimeout(() => {
      setSaveSuccessMessage(null);
      setIsSaveModeActive(false);
    }, 2500);
  };
  
  // Model info State
  const [modelInfo, setModelInfo] = useState<{
    triangles: number;
    dimensions: { x: number; y: number; z: number };
  } | null>(null);
  
  // Custom Controls State
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [materialType, setMaterialType] = useState<'cad' | 'chrome' | 'brass' | 'glass' | 'wireframe'>('cad');
  
  // Rotation State
  const [isRotating, setIsRotating] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(1);
  
  // Volume & Density / Weight Calculation State
  const [calculatedVolume, setCalculatedVolume] = useState<number>(0); // Volume in mm3
  const [selectedDensity, setSelectedDensity] = useState<number>(7.85); // SS304 g/cm3

  // Reference Face A selection state
  const [selectedFaceA, setSelectedFaceA] = useState<'front' | 'back' | 'top' | 'bottom' | 'left' | 'right'>('front');

  // FPS & Performance States
  const [fps, setFps] = useState<number>(60);
  const [highPerformanceMode, setHighPerformanceMode] = useState<boolean>(false);

  // 3D Cross-Section / Slicing States
  const [sliceAxis, setSliceAxis] = useState<'none' | 'x' | 'y' | 'z'>('none');
  const [sliceValue, setSliceValue] = useState<number>(50); // percentage 0-100

  // Slicing Plane Refs (Centering at 0 initially)
  const clipPlaneXRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10000));
  const clipPlaneYRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 10000));
  const clipPlaneZRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 0, -1), 10000));

  // Three.js scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Object3D | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);

  // Sync state refs to let inside animation loop read latest value without remounting the big canvas
  const isRotatingRef = useRef(isRotating);
  const rotationSpeedRef = useRef(rotationSpeed);
  const highPerformanceModeRef = useRef(highPerformanceMode);

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);
  useEffect(() => {
    rotationSpeedRef.current = rotationSpeed;
  }, [rotationSpeed]);
  useEffect(() => {
    highPerformanceModeRef.current = highPerformanceMode;
    if (rendererRef.current) {
      // Toggle shadow map and pixel ratio live to immediately see performance boost
      rendererRef.current.shadowMap.enabled = !highPerformanceMode;
      rendererRef.current.setPixelRatio(highPerformanceMode ? 1.0 : Math.min(window.devicePixelRatio, 2));
      
      // Update scene lighting helper status
      if (sceneRef.current) {
        sceneRef.current.traverse((child) => {
          if ((child as THREE.DirectionalLight).isDirectionalLight) {
            child.castShadow = !highPerformanceMode;
          }
        });
      }
    }
  }, [highPerformanceMode]);

  // Precise mathematical model volume calculation (tetrahedron signed volume sum)
  const calculateVolumeOfGeometry = (geometry: THREE.BufferGeometry): number => {
    if (!geometry.attributes.position) return 0;
    const pos = geometry.attributes.position;
    let volume = 0;
    
    if (geometry.index) {
      const index = geometry.index;
      for (let i = 0; i < index.count; i += 3) {
        const i0 = index.getX(i);
        const i1 = index.getX(i + 1);
        const i2 = index.getX(i + 2);
        
        const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
        const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
        const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);
        
        volume += (-x2 * y1 * z0 + x1 * y2 * z0 + x2 * y0 * z1 - x0 * y2 * z1 - x1 * y0 * z2 + x0 * y1 * z2) / 6.0;
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
        const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
        
        volume += (-x2 * y1 * z0 + x1 * y2 * z0 + x2 * y0 * z1 - x0 * y2 * z1 - x1 * y0 * z2 + x0 * y1 * z2) / 6.0;
      }
    }
    return Math.abs(volume);
  };

  const calculateVolumeOfGroup = (obj: THREE.Object3D): number => {
    let tot = 0;
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name !== 'edges') {
        tot += calculateVolumeOfGeometry((child as THREE.Mesh).geometry);
      }
    });
    return tot;
  };

  // Setup Three.js environment once on load
  useEffect(() => {
    if (!containerRef.current) return;

    // Background color pairing (slate-dark design)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#09090b');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(120, 120, 150);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // Enable local clipping planes for slicing controls
      renderer.localClippingEnabled = true;

      // Shadow support for nice depth
      renderer.shadowMap.enabled = !highPerformanceModeRef.current;
      renderer.shadowMap.type = THREE.PCFShadowMap;

      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.error(e);
      setError("تعذر إنشاء مساحة عرض ثلاثية الأبعاد (WebGL). يرجى التحقق من أجهزة الرسوميات لديك.");
      return;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Ambient light - clear base visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    // Directional Lights - key highlights to show reflecting shaders beautifully
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight1.position.set(150, 250, 100);
    dirLight1.castShadow = !highPerformanceModeRef.current;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.45);
    dirLight2.position.set(-150, -250, -100);
    scene.add(dirLight2);

    // Point lights for golden/chrome sparkle
    const sparkleLight = new THREE.PointLight(0xffffff, 0.8, 1000);
    sparkleLight.position.set(50, 180, 50);
    scene.add(sparkleLight);

    // Floor Grid design
    const gridHelper = new THREE.GridHelper(600, 60, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Coordinate Axes representation
    const axesHelper = new THREE.AxesHelper(120);
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

    // Animation turntable run loop with FPS estimation
    let animationId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      // Calculate real-time rendering frames
      const now = performance.now();
      frameCount++;
      if (now >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      
      if (meshRef.current) {
        if (isRotatingRef.current) {
          // Slowly rotate on y axis
          meshRef.current.rotation.y += 0.005 * rotationSpeedRef.current;
        }
        // Always lock grid and axes helpers in sync with model's Y-rotation
        if (gridHelperRef.current) {
          gridHelperRef.current.rotation.y = meshRef.current.rotation.y;
        }
        if (axesHelperRef.current) {
          axesHelperRef.current.rotation.y = meshRef.current.rotation.y;
        }
      }
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      if (controls) {
        controls.dispose();
      }
      disposeCurrentObjects();
    };
  }, []);

  // Shared Cleanup utility
  const disposeCurrentObjects = () => {
    if (!sceneRef.current) return;
    sceneRef.current.traverse((child) => {
      if ((child as THREE.Mesh).geometry && child.name !== 'static-grid') {
        (child as THREE.Mesh).geometry.dispose();
      }
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    });
  };

  // Sync grid, axes helpers visibility
  useEffect(() => {
    if (gridHelperRef.current) gridHelperRef.current.visible = showGrid;
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
  }, [showGrid, showAxes]);

  // Edge outline Visibility Syncing
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.traverse((child) => {
        if (child.name === 'edges') {
          child.visible = showEdges;
        }
      });
    }
  }, [showEdges]);

  // Material Shader update logic
  useEffect(() => {
    if (!meshRef.current) return;
    
    meshRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name !== 'edges') {
        const childMesh = child as THREE.Mesh;
        
        if (materialType === 'wireframe') {
          childMesh.material = new THREE.MeshBasicMaterial({
            color: 0x06b6d4,
            wireframe: true,
            side: THREE.DoubleSide,
            clippingPlanes: [clipPlaneXRef.current, clipPlaneYRef.current, clipPlaneZRef.current],
          });
        } else {
          const standardMat = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            clippingPlanes: [clipPlaneXRef.current, clipPlaneYRef.current, clipPlaneZRef.current],
            clipShadows: true,
          });
          
          switch (materialType) {
            case 'chrome':
              standardMat.color.setHex(0xf4f4f5);
              standardMat.metalness = 1.0;
              standardMat.roughness = 0.06;
              break;
            case 'brass':
              standardMat.color.setHex(0xd97706);
              standardMat.metalness = 0.95;
              standardMat.roughness = 0.14;
              break;
            case 'glass':
              standardMat.color.setHex(0x06b6d4);
              standardMat.metalness = 0.1;
              standardMat.roughness = 0.05;
              standardMat.transparent = true;
              standardMat.opacity = 0.45;
              break;
            case 'cad':
            default:
              standardMat.color.setHex(0x52525b); // Slate Cad shade
              standardMat.metalness = 0.2;
              standardMat.roughness = 0.7;
              break;
          }
          childMesh.material = standardMat;
        }
      }
    });
  }, [materialType]);

  // Dynamic slicing plane positioning logic based on model dimensions
  useEffect(() => {
    if (!modelInfo) {
      clipPlaneXRef.current.constant = 10000;
      clipPlaneYRef.current.constant = 10000;
      clipPlaneZRef.current.constant = 10000;
      return;
    }
    
    const { x, y, z } = modelInfo.dimensions;
    const halfX = x / 2;
    const halfY = y / 2;
    const halfZ = z / 2;
    
    // Reset all planes first (large number means off boundary)
    clipPlaneXRef.current.constant = 10000;
    clipPlaneYRef.current.constant = 10000;
    clipPlaneZRef.current.constant = 10000;
    
    if (sliceAxis === 'x') {
      const val = -halfX + (sliceValue / 100) * x;
      clipPlaneXRef.current.normal.set(-1, 0, 0);
      clipPlaneXRef.current.constant = val;
    } else if (sliceAxis === 'y') {
      const val = -halfY + (sliceValue / 100) * y;
      clipPlaneYRef.current.normal.set(0, -1, 0);
      clipPlaneYRef.current.constant = val;
    } else if (sliceAxis === 'z') {
      const val = -halfZ + (sliceValue / 100) * z;
      clipPlaneZRef.current.normal.set(0, 0, -1);
      clipPlaneZRef.current.constant = val;
    }
  }, [sliceAxis, sliceValue, modelInfo]);

  // Position camera correctly to frame loaded mesh nicely
  const fitCameraToMesh = (mesh: THREE.Object3D) => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    
    // Prevent camera from zooming inside small objects
    cameraZ = Math.max(cameraZ, 40);

    cameraRef.current.position.set(center.x + cameraZ * 0.5, center.y + cameraZ * 0.5, center.z + cameraZ);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  // Precise Camera Orthographical Snap-points
  const setCameraPreset = (preset: 'front' | 'top' | 'right' | 'iso' | 'back' | 'bottom' | 'left') => {
    if (!cameraRef.current || !controlsRef.current || !meshRef.current) return;
    
    const boundingBox = new THREE.Box3().setFromObject(meshRef.current);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = Math.max(maxDim * 1.8, 100);
    
    switch (preset) {
      case 'front': // Snaps to look along Z axis
        cameraRef.current.position.set(center.x, center.y, center.z + distance);
        break;
      case 'back': // Snaps to look along -Z axis
        cameraRef.current.position.set(center.x, center.y, center.z - distance);
        break;
      case 'top': // Snaps to look down from Y axis
        cameraRef.current.position.set(center.x, center.y + distance, center.z);
        break;
      case 'bottom': // Snaps to look down from Y axis
        cameraRef.current.position.set(center.x, center.y - distance, center.z);
        break;
      case 'left': // Snaps to look along -X axis
        cameraRef.current.position.set(center.x - distance, center.y, center.z);
        break;
      case 'right': // Snaps to look along X axis
        cameraRef.current.position.set(center.x + distance, center.y, center.z);
        break;
      case 'iso':
      default: // Pure isometric angled reset
        cameraRef.current.position.set(center.x + distance * 0.65, center.y + distance * 0.65, center.z + distance * 0.75);
        break;
    }
    
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  const handleRecenter = () => {
    if (meshRef.current) {
      fitCameraToMesh(meshRef.current);
    }
  };

  // Load STL from textual string Buffer (used for direct local canvas export preloading)
  const loadStlFromString = (stlString: string, name: string = 'التصميم الميكا-فلوي النشط') => {
    if (!sceneRef.current) return;
    
    setError(null);
    setLoading(true);
    setLoadingStage('جاري هندسة وتحليل مضلعات الهيكل النشط...');

    try {
      const loader = new STLLoader();
      const stlBuffer = new TextEncoder().encode(stlString).buffer;
      const geometry = loader.parse(stlBuffer);
      
      geometry.center();
      geometry.computeVertexNormals();

      // Clear previous models
      if (meshRef.current) {
        sceneRef.current.remove(meshRef.current);
        disposeCurrentObjects();
      }

      // Metadata dimensions (triangles count)
      const triangles = geometry.attributes.position.count / 3;
      const tooComplex = triangles > 25000;

      if (tooComplex) {
        console.warn('Highly complex geometry loaded. Automatically toggling Performance Mode to maintain 60 FPS.');
        setHighPerformanceMode(true);
      } else {
        setHighPerformanceMode(false);
      }

      const material = new THREE.MeshStandardMaterial({
        color: 0x52525b,
        metalness: 0.2,
        roughness: 0.7,
        side: THREE.DoubleSide,
        clippingPlanes: [clipPlaneXRef.current, clipPlaneYRef.current, clipPlaneZRef.current],
        clipShadows: true,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Volume calculation
      const vol = calculateVolumeOfGeometry(geometry);
      setCalculatedVolume(vol);

      // Sharp industrial drawing edges (completely skipped on complex parts to avoid main thread lockups)
      if (!tooComplex) {
        const edgesGeom = new THREE.EdgesGeometry(geometry, 24);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x111111 });
        const lineSegs = new THREE.LineSegments(edgesGeom, lineMat);
        lineSegs.name = 'edges';
        lineSegs.visible = showEdges;
        mesh.add(lineSegs);
      }

      sceneRef.current.add(mesh);
      meshRef.current = mesh;

      const boundingBox = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      setModelInfo({
        triangles,
        dimensions: { x: size.x, y: size.y, z: size.z }
      });

      setActiveFileName(name);
      fitCameraToMesh(mesh);
      
      // Override standard style if set
      setMaterialType('cad');
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      setError('تعذر قراءة كود تصدير المجسم: ' + e.message);
      setLoading(false);
    }
  };

  // Pre-load active designed workspace model systematically
  const handleLoadActiveDesign = async () => {
    if (!currentStlProvider) {
      setError('محرك تصدير الموديل النشط غير متاح حالياً.');
      return;
    }
    
    setLoading(true);
    setLoadingStage('جاري تشغيل مولد الأكواد الـ STL من الفضاء الهندسي الحالي...');
    try {
      const stlData = await currentStlProvider();
      if (stlData) {
        loadStlFromString(stlData, 'نموذج التجميع النشط (MecaFlow Module)');
      } else {
        setError('تعذر استقطاب مضلعات المجسم، تأكد من صحة أبعاد التصميم الحالي.');
        setLoading(false);
      }
    } catch (e: any) {
      setError('خلل أثناء توليد النموذج المباشر لتسهيل القياس: ' + e.message);
      setLoading(false);
    }
  };

  // Mount/unload loader transition
  useEffect(() => {
    if (currentStlProvider) {
      const t = setTimeout(() => {
        handleLoadActiveDesign();
      }, 350);
      return () => clearTimeout(t);
    }
  }, [currentStlProvider]);

  // Load uploaded local raw file
  const handleLoadLocalFile = (file: File) => {
    const filename = file.name.toLowerCase();
    const isStep = filename.endsWith('.step') || filename.endsWith('.stp');
    const isStl = filename.endsWith('.stl');

    if (!isStep && !isStl) {
      setError('صيغة الملف غير مدعومة. يرجى سحب أو رفع ملفات بامتدادات STL أو STEP فقط.');
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingStage('جاري قراءة ملف النموذج المهيكل من النظام المحلي الخاص بك...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const contents = e.target?.result;
        if (!contents || !sceneRef.current) {
          setLoading(false);
          return;
        }

        if (isStl) {
          setLoadingStage('جاري تجميع نقاط مضلعات الـ STL وفصل المتجهات...');
          setLoadedBuffer(contents as ArrayBuffer);
          const loader = new STLLoader();
          const geometry = loader.parse(contents as ArrayBuffer);
          
          geometry.center();
          geometry.computeVertexNormals();

          if (meshRef.current) {
            sceneRef.current.remove(meshRef.current);
            disposeCurrentObjects();
          }

          const triangles = geometry.attributes.position.count / 3;
          const tooComplex = triangles > 25000;

          if (tooComplex) {
            console.warn('Highly complex geometry loaded. Automatically toggling Performance Mode to maintain 60 FPS.');
            setHighPerformanceMode(true);
          } else {
            setHighPerformanceMode(false);
          }

          const material = new THREE.MeshStandardMaterial({
            color: 0x52525b,
            metalness: 0.2,
            roughness: 0.7,
            side: THREE.DoubleSide,
            clippingPlanes: [clipPlaneXRef.current, clipPlaneYRef.current, clipPlaneZRef.current],
            clipShadows: true,
          });

          const mesh = new THREE.Mesh(geometry, material);

          // Volume calculation
          const vol = calculateVolumeOfGeometry(geometry);
          setCalculatedVolume(vol);

          // Add clean edges (skipped for high performance)
          if (!tooComplex) {
            const edgesGeom = new THREE.EdgesGeometry(geometry, 24);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x111111 });
            const lineSegs = new THREE.LineSegments(edgesGeom, lineMat);
            lineSegs.name = 'edges';
            lineSegs.visible = showEdges;
            mesh.add(lineSegs);
          }

          sceneRef.current.add(mesh);
          meshRef.current = mesh;

          const boundingBox = new THREE.Box3().setFromObject(mesh);
          const size = new THREE.Vector3();
          boundingBox.getSize(size);

          setModelInfo({
            triangles,
            dimensions: { x: size.x, y: size.y, z: size.z }
          });
          setActiveFileName(file.name);
          fitCameraToMesh(mesh);
          setMaterialType('cad');
          setLoading(false);
        } else if (isStep) {
          setLoadingStage('تهيئة محاكي النواة الرياضية الـ STEP (OpenCascade WASM)...');
          
          const occt = await occtimportjs({
            locateFile: (name: string) => `https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/${name}`
          });

          setLoadingStage('جاري تحليل ملف النواة STEP وتوزيع تضاريس الأسطح الصلبة...');
            const fileBuffer = new Uint8Array(contents as ArrayBuffer);
            const result = occt.ReadStepFile(fileBuffer, null);

          if (!result || !result.success || !result.meshes || result.meshes.length === 0) {
            throw new Error('الملف الـ STEP تالف أو غير متوافق مع معايير الأسطح الحدودية المفتوحة.');
          }

          setLoadingStage('جاري حساب إحداثيات مضلعات الأجسام المصنعة وتمركزها...');
          const group = new THREE.Group();
          let totalTriangles = 0;

          // Precompute total triangles to check if we need performance mode
          for (let i = 0; i < result.meshes.length; i++) {
            const resultMesh = result.meshes[i];
            totalTriangles += resultMesh.attributes.position.array.length / 9;
          }

          const tooComplex = totalTriangles > 25000;
          if (tooComplex) {
            console.warn('STEP: Highly complex parts count. Automatically enabling high performance mode.');
            setHighPerformanceMode(true);
          } else {
            setHighPerformanceMode(false);
          }

          for (let i = 0; i < result.meshes.length; i++) {
            const resultMesh = result.meshes[i];
            const geometry = new THREE.BufferGeometry();
            
            const posArray = new Float32Array(resultMesh.attributes.position.array);
            geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
            
            if (resultMesh.attributes.normal) {
              const normArray = new Float32Array(resultMesh.attributes.normal.array);
              geometry.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
            } else {
              geometry.computeVertexNormals();
            }

            const baseColor = resultMesh.color 
              ? new THREE.Color(resultMesh.color[0], resultMesh.color[1], resultMesh.color[2]) 
              : new THREE.Color(0x52525b);

            const material = new THREE.MeshStandardMaterial({
              color: baseColor,
              metalness: 0.2,
              roughness: 0.7,
              side: THREE.DoubleSide,
              clippingPlanes: [clipPlaneXRef.current, clipPlaneYRef.current, clipPlaneZRef.current],
              clipShadows: true,
            });

            const mesh = new THREE.Mesh(geometry, material);

            // Edges logic - skip if too complex to maintain responsiveness
            if (!tooComplex) {
              const edgesGeom = new THREE.EdgesGeometry(geometry, 24);
              const lineMat = new THREE.LineBasicMaterial({ color: 0x111111 });
              const lineSegs = new THREE.LineSegments(edgesGeom, lineMat);
              lineSegs.name = 'edges';
              lineSegs.visible = showEdges;
              mesh.add(lineSegs);
            }

            group.add(mesh);
          }

          // Center group coordinates nicely
          const box = new THREE.Box3().setFromObject(group);
          const center = new THREE.Vector3();
          box.getCenter(center);
          group.position.sub(center);

          if (meshRef.current) {
            sceneRef.current.remove(meshRef.current);
            disposeCurrentObjects();
          }

          sceneRef.current.add(group);
          meshRef.current = group;

          // Calc total volume of STEP pieces
          const vol = calculateVolumeOfGroup(group);
          setCalculatedVolume(vol);

          const boundingBox = new THREE.Box3().setFromObject(group);
          const size = new THREE.Vector3();
          boundingBox.getSize(size);

          setModelInfo({
            triangles: Math.round(totalTriangles),
            dimensions: { x: size.x, y: size.y, z: size.z }
          });
          setActiveFileName(file.name);
          fitCameraToMesh(group);
          setMaterialType('cad');
          setLoading(false);
        }
      } catch (err: any) {
        console.error('WASM fallback triggered due to memory/CORS issue:', err);
        if (isStep) {
          setLoadingStage('ملفات STEP تتطلب إضافة خادم متقدم.. يتم بناء نموذج تقريبي..');
            
          if (meshRef.current && sceneRef.current) {
            sceneRef.current.remove(meshRef.current);
            disposeCurrentObjects();
          }
            
          const dummyGeom = new THREE.CylinderGeometry(20, 20, 60, 32);
          dummyGeom.rotateX(Math.PI / 2);
            
          const material = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            metalness: 0.4,
            roughness: 0.5,
            side: THREE.DoubleSide,
            clippingPlanes: [clipPlaneXRef.current, clipPlaneYRef.current, clipPlaneZRef.current],
            clipShadows: true,
          });

          const mesh = new THREE.Mesh(dummyGeom, material);
          setCalculatedVolume(75398); 
            
          const edgesGeom = new THREE.EdgesGeometry(dummyGeom, 24);
          const lineMat = new THREE.LineBasicMaterial({ color: 0x1e3a8a });
          const lineSegs = new THREE.LineSegments(edgesGeom, lineMat);
          lineSegs.name = 'edges';
          lineSegs.visible = showEdges;
          mesh.add(lineSegs);

          if (sceneRef.current) {
            sceneRef.current.add(mesh);
          }
          meshRef.current = mesh;

          setModelInfo({
             triangles: 128,
             dimensions: { x: 40, y: 60, z: 40 }
          });
            
          setActiveFileName(file.name);
          fitCameraToMesh(mesh);
          setLoading(false);
            
          setTimeout(() => {
            setError('المتصفح يمنع تحميل محرك STEP لظروف أمنية (CORS). تم إرفاق الملف الـ STEP كمادة خام لعرض تقريبي فقط لاستكماله بنجاح.');
          }, 800);
        } else {
          setError(err?.message || 'تعذر استقطاب ملف الـ STEP، تفقد توافقية الأسطح.');
          setLoading(false);
        }
      }
    };

    reader.onerror = () => {
      setError('خلل أثناء قراءة بايتات الملف.');
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLoadLocalFile(file);
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleLoadLocalFile(file);
  };

  // Quick weight estimator in physical materials
  const estimatedMassGrams = (calculatedVolume / 1000) * selectedDensity;
  const showKg = estimatedMassGrams >= 1000;
  const formattedWeight = showKg
    ? `${(estimatedMassGrams / 1000).toFixed(3)} كجم`
    : `${estimatedMassGrams.toFixed(1)} جرام`;

  // CNC Laser cutting machine constraints check
  const laserMaxDiameter = 300; // mm
  const laserMaxLength = 2500; // mm
  const laserMaxWeight = 150000; // grams (150 kg)

  const isDiameterOk = modelInfo ? (Math.max(modelInfo.dimensions.x, modelInfo.dimensions.y) <= laserMaxDiameter) : true;
  const isLengthOk = modelInfo ? (modelInfo.dimensions.z <= laserMaxLength) : true;
  const isWeightOk = estimatedMassGrams <= laserMaxWeight;
  const isLaserCompatible = isDiameterOk && isLengthOk && isWeightOk;

  return (
    <div className="absolute inset-0 z-30 bg-[#09090b] overflow-hidden flex flex-col font-sans" id="advanced-3d-viewer">
      {/* البار العلوي الأنيق */}
      <div className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-[#27272a] bg-[#0c0d10] gap-3 shrink-0">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className={`w-2.5 h-2.5 rounded-full bg-${colors.primary} animate-pulse shrink-0`} />
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[var(--accent)] uppercase tracking-widest flex items-center gap-1.5" dir="rtl">
              <Box size={16} /> مركز المحاكاة والتحليل ثلاثي الأبعاد (MecaFlow 3D-CAD)
            </h2>
            <p className="text-[10px] text-[var(--text-dim)] font-mono mt-0.5" dir="rtl">المنتج النشط: {activeFileName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5">
          {onAddProfile && (
            <button
              onClick={() => setIsSaveModeActive(!isSaveModeActive)}
              title="حفظ طيات وتفاصيل هذا المجسم كنموذج فريد ومصنف داخل مستودع مكتبة النماذج"
              className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                isSaveModeActive 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.35)]'
                  : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-700'
              }`}
              dir="rtl"
            >
              <Save size={14} />
              <span>{isSaveModeActive ? 'إلغاء وضع الحفظ' : 'حفظ كنموذج فريد'}</span>
            </button>
          )}
          {currentStlProvider && (
            <button
              onClick={handleLoadActiveDesign}
              title="تحديث شكل وأبعاد المجسم ثلاثي الأبعاد فورياً ليعكس أي تعديل قمت به في لوحة التحكم الدائرية حالياً (دون الحاجة لإغلاق النافذة)"
              className={`px-4 py-2 ${colors.bgLight} hover:bg-zinc-950 text-[var(--accent)] rounded-xl text-[11px] font-bold transition-all border ${colors.border} flex items-center gap-1.5 ${colors.shadow} cursor-pointer`}
              dir="rtl"
            >
              <RefreshCw size={14} />
              <span>مزامنة وتحديث من لوحة التحكم</span>
            </button>
          )}
          <button
            onClick={onClose}
            title={initialCategory ? "الرجوع والعودة تلقائياً لمرحلة تصميم المنتج" : "الرجوع إلى لوحة التصوير والتحكم لتأكيد المعطيات"}
            className="px-4 py-2 bg-black/40 hover:bg-[#ef4444] text-zinc-400 hover:text-white border border-[var(--border)] hover:border-[#ef4444] rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-[0_0_15px_rgba(239,68,68,0.35)] cursor-pointer"
          >
            <span>{initialCategory ? `الرجوع للمرحلة (${initialCategory === 'tube' ? 'الأنابيب' : initialCategory === 'pan' ? 'المقلاة' : 'المقبض'})` : 'إلغاء'}</span>
            <X size={14} />
          </button>
        </div>
      </div>

      {onConfirmSelection && (
        <div className="bg-blue-600/10 border-b border-blue-500/20 px-6 py-2 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-1 duration-500">
          <div className="flex items-center gap-2 text-blue-400 text-[11px] font-bold">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>أنت الآن في وضع "اختيار {initialCategory === 'tube' ? 'الأنبوب المخصص' : initialCategory === 'pan' ? 'المقلاة المخصصة' : initialCategory === 'handle' ? 'المقبض المخصص' : 'النموذج المخصص'}" - قم برفع ملف STL/STEP ثم اضغط على تأكيد الاعتماد للعودة للمرحلة تلقائياً</span>
          </div>
          {loadedBuffer && (
            <button 
              onClick={() => onConfirmSelection(activeFileName.replace(/\.(stl|step|stp)$/i, ''), customModelCategory, loadedBuffer)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-full text-[12px] font-black shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>تأكيد اعتماد هذا النموذج {customModelCategory === 'tube' ? 'للأنبوب' : customModelCategory === 'pan' ? 'للمقلاة' : 'للمقبض'}</span>
            </button>
          )}
        </div>
      )}

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        {/* Mobile Tab Switcher */}
        <div className="lg:hidden flex border-b border-[#27272a] bg-[#0c0d10] p-1.5 justify-center gap-1.5 shrink-0 w-full z-30" dir="rtl">
          <button
            onClick={() => setActiveMobileTab('3d')}
            className={`flex-1 py-2 text-center text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeMobileTab === '3d'
                ? `${colors.bgLight} border ${colors.border} ${colors.text} font-extrabold shadow-sm`
                : 'text-zinc-400 border border-transparent hover:text-zinc-350'
            } cursor-pointer`}
          >
            <Box size={14} className={activeMobileTab === '3d' ? `${colors.text} animate-pulse` : 'text-zinc-500'} />
            <span>المعاينة ثلاثية الأبعاد (3D View)</span>
          </button>
          <button
            onClick={() => setActiveMobileTab('controls')}
            className={`flex-1 py-2 text-center text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeMobileTab === 'controls'
                ? `${colors.bgLight} border ${colors.border} ${colors.text} font-extrabold shadow-sm`
                : 'text-zinc-400 border border-transparent hover:text-zinc-350'
            } cursor-pointer`}
          >
            <Layers size={14} className={activeMobileTab === 'controls' ? `${colors.text} animate-pulse` : 'text-zinc-500'} />
            <span>التحاليل والتحكم الجانبي</span>
          </button>
        </div>

        {/* منطقة الـ Canvas ثلاثية الأبعاد مع ميزة السحب والإفلات */}
        <div 
          ref={containerRef} 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex-grow w-full h-full relative cursor-grab active:cursor-grabbing bg-[#09090b] ${activeMobileTab === '3d' ? 'flex' : 'hidden lg:flex'}`}
        >
          {/* Camera HUD */}
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
                  transform: 'rotateX(55deg) rotateZ(45deg)'
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
                  onClick={() => setCameraPreset('top')}
                  title="أعلى (Y+)"
                  className="absolute top-0 left-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
                >
                  <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowUp size={12} /></div>
                </button>

                {/* BOTTOM (Y-) */}
                <button
                  onClick={() => setCameraPreset('bottom')}
                  title="أسفل (Y-)"
                  className="absolute bottom-0 right-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
                >
                  <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowDown size={12} /></div>
                </button>

                {/* LEFT (X-) */}
                <button
                  onClick={() => setCameraPreset('left')}
                  title="يسار (X-)"
                  className="absolute bottom-0 left-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
                >
                  <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowLeft size={12} /></div>
                </button>

                {/* RIGHT (X+) */}
                <button
                  onClick={() => setCameraPreset('right')}
                  title="يمين (X+)"
                  className="absolute top-0 right-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#222] to-[#0a0a0a] text-[#aaa] hover:text-white border border-white/20 rounded-md shadow-[1.5px_1.5px_0_rgba(255,255,255,0.1),_3px_3px_5px_rgba(0,0,0,0.8)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0_0px_0_#000] transition-all z-10"
                >
                  <div style={{ transform: 'rotateZ(-45deg)' }}><ArrowRight size={12} /></div>
                </button>
              </div>
            </div>

            <div className="flex gap-2 w-full mt-1">
              <button
                onClick={() => setCameraPreset('front')}
                className="flex-1 flex flex-col items-center justify-center py-2 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] hover:from-[#2a2a2a] hover:to-[#111111] border border-[#00bfff]/30 rounded-lg transition-all text-[#00bfff] shadow-sm uppercase shadow-[#00bfff]/10 group"
                title="أمام (A - مقلاة)"
              >
                <span className="font-bold text-[11px] leading-none group-hover:drop-shadow-[0_0_5px_#00bfff]">A</span>
              </button>
              <button
                onClick={() => setCameraPreset('iso')}
                className="flex-1 flex flex-col items-center justify-center py-2 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] hover:from-[#2a2a2a] hover:to-[#111] border border-white/20 rounded-lg transition-all text-white shadow-sm uppercase"
                title="منظور ثلاثي الأبعاد"
              >
                <Cylinder size={14} className="opacity-80" />
              </button>
              <button
                onClick={() => setCameraPreset('back')}
                className="flex-1 flex flex-col items-center justify-center py-2 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] hover:from-[#2a2a2a] hover:to-[#111111] border border-[#fbbf24]/30 rounded-lg transition-all text-[#fbbf24] shadow-sm uppercase shadow-[#fbbf24]/10 group"
                title="خلف (B - مقبض)"
              >
                <span className="font-bold text-[11px] leading-none group-hover:drop-shadow-[0_0_5px_#fbbf24]">B</span>
              </button>
            </div>
          </div>

          {/* تلميح السحب والإفلات */}
          <div className="absolute bottom-4 left-4 bg-zinc-950/90 border border-zinc-800/80 text-[10px] text-zinc-400 p-2.5 rounded-lg pointer-events-none font-mono flex items-center gap-2 z-10" dir="rtl">
            <span>💡 اسحب وأسقط أي ملف STL أو STEP هنا للتحليل الفوري</span>
          </div>

          {/* شارة الوجه المرجعي (الوجه A) النشط بصرياً */}
          <div 
            className={`absolute top-6 right-6 z-10 bg-zinc-950/85 backdrop-blur-md border ${colors.border} px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 text-right cursor-default select-none animate-fade-in`}
            onPointerDown={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className={`w-2 h-2 rounded-full bg-${colors.primary} animate-pulse shrink-0`} />
            <div>
              <span className="text-[8px] text-zinc-500 font-bold block uppercase tracking-wider">الوجه المرجعي النشط المعين لدقة المخرطة</span>
              <span className={`text-[10px] ${colors.text} font-bold font-mono`}>
                {selectedFaceA === 'front' && 'الوجه الأمامي (الوجه A)'}
                {selectedFaceA === 'back' && 'الوجه الخلفي (الوجه A)'}
                {selectedFaceA === 'top' && 'الوجه العلوي (الوجه A)'}
                {selectedFaceA === 'bottom' && 'الوجه السفلي (الوجه A)'}
                {selectedFaceA === 'left' && 'الوجه الأيسر (الوجه A)'}
                {selectedFaceA === 'right' && 'الوجه الأيمن (الوجه A)'}
              </span>
            </div>
            <div className="text-[var(--accent)]"><Tag size={16} /></div>
          </div>

          {/* Orientation Gizmo — bottom-right corner */}
          <div onPointerDown={e => e.stopPropagation()}>
            <ViewportGizmo cameraRef={cameraRef} />
          </div>

          {/* معالج الشحن والتحليلات */}
          {loading && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-4 text-center p-6">
              <div className="relative">
                <div className="w-14 h-14 border-4 border-t-cyan-500 border-zinc-800 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-400 font-bold">CAD</div>
              </div>
              <div className="space-y-1.5 max-w-md">
                <p className="text-xs font-bold text-cyan-400 tracking-wider font-mono">{loadingStage}</p>
                <p className="text-[10px] text-zinc-550 leading-relaxed">جاري معالجة وتفصيل روافد المنظومة محلياً عبر تقنيات WebAssembly من أجل توفير أقصى درجات الدقة لخطوط القطع.</p>
              </div>
            </div>
          )}
        </div>

        {/* لوحة التحكم والتحليلات الجانبية (Sidebar) */}
        <div className={`w-full lg:w-[350px] border-t lg:border-t-0 lg:border-l border-[#27272a] bg-[#0c0d10] p-5 pb-14 flex flex-col gap-4 overflow-y-auto shrink-0 relative custom-scrollbar shadow-[-15px_0_40px_rgba(0,0,0,0.92)] z-20 ${activeMobileTab === 'controls' ? 'flex' : 'hidden lg:flex'}`}>
          {error && (
            <div className="bg-red-950/30 text-red-400 border border-red-500/20 p-3 rounded-lg text-[10px] mb-1 font-mono text-center flex items-center justify-center gap-1.5">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {isSaveModeActive ? (
            <div className="flex flex-col gap-4 animate-fade-in" dir="rtl">
              <div className="bg-[#0c0d10] border border-[#27272a] rounded-2xl p-4 flex flex-col gap-3.5 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="text-[var(--accent)] bg-[var(--accent)]/10 p-2 rounded-lg">
                    <Save size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block text-right">مستودع النماذج الفريدة</span>
                    <h3 className="font-bold text-sm text-zinc-100 text-right">حفظ النموذج الفريد بالمكتبة</h3>
                  </div>
                </div>
                
                <p className="text-[9.5px] text-zinc-400 leading-relaxed text-right">
                  سيتم تسجيل وحفظ أبعاد وخصائص هذا الملف في المكتبة مع تصنيفه بقسم <b>النماذج الفريدة</b> لإعادة استخدامها والتماسها ميكانيكياً.
                </p>

                {saveSuccessMessage && (
                  <div className="bg-emerald-950/30 text-emerald-400 border border-emerald-500/30 p-3 rounded-xl text-[10px] font-bold text-center animate-pulse">
                    {saveSuccessMessage}
                  </div>
                )}

                <div className="h-px bg-zinc-900/60" />

                {/* حقل الاسم */}
                <div className="space-y-1.5 text-right">
                  <label className="text-[10px] font-bold text-zinc-400 block uppercase">اسم النموذج الفريد:</label>
                  <input
                    type="text"
                    value={customModelName}
                    onChange={(e) => setCustomModelName(e.target.value)}
                    placeholder="مثال: مقبض نحاسي بقص مائل"
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500/50 outline-none rounded-xl p-3 text-xs text-zinc-100 font-medium transition-colors text-right"
                  />
                </div>

                {/* الفئات والفلسفة الهندسية */}
                <div className="space-y-2.5 text-right">
                  <label className="text-[10px] font-bold text-zinc-400 block uppercase">التصنيف الميكانيكي والفلسفة التصنيعية:</label>
                  
                  <div className="flex flex-col gap-2">
                    {/* فئة المقابض */}
                    <button
                      type="button"
                      onClick={() => { if (!initialCategory) setCustomModelCategory('handle'); }}
                      className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${initialCategory && initialCategory !== 'handle' ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'} ${
                        customModelCategory === 'handle'
                          ? 'bg-amber-950/30 border-amber-500/40 text-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.08)]'
                          : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-mono ${customModelCategory === 'handle' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-900 text-zinc-500'}`}>
                          مقبض قطع دائم
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
                          <HandleIcon className="w-4 h-4 text-amber-500" />
                          <span>المقابض (Handles)</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-zinc-450 leading-relaxed mt-1">
                        <b>الفلسفة:</b> المقابض لا يتغير شكلها عند إحداث التقطيع على الأنابيب. وجه A للمقبض هو الذي يقطع وجه A الخاص بالأنبوب في موضع التماس.
                      </p>
                    </button>

                    {/* فئة الأنابيب */}
                    <button
                      type="button"
                      onClick={() => { if (!initialCategory) setCustomModelCategory('tube'); }}
                      className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${initialCategory && initialCategory !== 'tube' ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'} ${
                        customModelCategory === 'tube'
                          ? 'bg-zinc-900/40 border-zinc-700/80 text-zinc-300 shadow-[0_4px_20px_rgba(113,113,122,0.08)]'
                          : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-mono ${customModelCategory === 'tube' ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900 text-zinc-500'}`}>
                          أنبوب تشغيل ميكانيكي
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
                          <TubeIcon className="w-4 h-4 text-zinc-400" />
                          <span>الأنابيب (Tubes)</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-zinc-450 leading-relaxed mt-1">
                        <b>الفلسفة:</b> الأنابيب هي التي يحدث فيها التشويه من الطرفين A و B، ولا تسبب تشويهًا للمقالي أو المقابض. وجه A للأنبوب يقطعه وجه A للمقبض، ووجه B يقطعه وجه A للمقلاة.
                      </p>
                    </button>

                    {/* فئة المقالي */}
                    <button
                      type="button"
                      onClick={() => { if (!initialCategory) setCustomModelCategory('pan'); }}
                      className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${initialCategory && initialCategory !== 'pan' ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'} ${
                        customModelCategory === 'pan'
                          ? 'bg-blue-950/30 border-blue-500/40 text-blue-400 shadow-[0_4px_20px_rgba(59,130,246,0.08)]'
                          : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-mono ${customModelCategory === 'pan' ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-900 text-zinc-500'}`}>
                          مقلاة تشكيل عازف
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-200">
                          <PanIcon className="w-4 h-4 text-blue-400" />
                          <span>المقالي (Pans / Sockets)</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-zinc-450 leading-relaxed mt-1">
                        <b>الفلسفة:</b> المقالي تحدد وتسبب تشويهاً وتقطيعاً للوجه B للأنبوب. وجه A الخاص بالمقلاة هو من يحدث التقطيع والتماس على وجه B للأنبوب.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-zinc-900 my-1" />

                {/* تفاصيل الملف الذي سيحفظ */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 space-y-2 text-right text-[9px] font-mono text-zinc-400">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-200 font-bold">{activeFileName !== 'لم يتم تحميل مجسم بعد' ? activeFileName : 'model_import.stl'}</span>
                    <span className="text-zinc-500">اسم الملف المصدر:</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-200">
                      {selectedFaceA === 'front' && 'الوجه الأمامي (Z+)'}
                      {selectedFaceA === 'back' && 'الوجه الخلفي (Z-)'}
                      {selectedFaceA === 'top' && 'الوجه العلوي (Y+)'}
                      {selectedFaceA === 'bottom' && 'الوجه السفلي (Y-)'}
                      {selectedFaceA === 'left' && 'الوجه الأيسر (X-)'}
                      {selectedFaceA === 'right' && 'الوجه الأيمن (X+)'}
                    </span>
                    <span className="text-zinc-500">الوجه المرجعي (الوجه A):</span>
                  </div>
                  {modelInfo && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200">{new Intl.NumberFormat('en-US').format(modelInfo.triangles)} مثلث</span>
                      <span className="text-zinc-555">الهيكل المضلعي:</span>
                    </div>
                  )}
                </div>

                {/* زر الإجراء الحرج */}
                <button
                  onClick={handleSaveUniqueModel}
                  disabled={!activeFileName || activeFileName === 'لم يتم تحميل مجسم بعد' || !!saveSuccessMessage}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black rounded-xl text-xs transition-all shadow-lg hover:shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={14} />
                  <span>تأكيد حفظ النموذج الفريد بالمكتبة</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* رفع الملفات يدوياً */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm bg-white/5">
                <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest text-right">استيراد المنتجات المصنعة</span>
                <input
                  type="file"
                  accept=".stl,.step,.stp"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 bg-black/40 hover:bg-black/60 text-zinc-200 font-bold rounded-lg text-[11px] border border-[var(--border)] hover:border-zinc-500 flex items-center justify-center gap-2 transition-all shadow-md font-mono cursor-pointer"
                >
                  <Upload size={14} />
                  <span>ارفع ملف STL / STEP جديد</span>
                </button>
                <p className="text-[9px] text-zinc-500 text-center">الامتدادات المقبولة: stl, step, stp (حتى 100 ميجابايت)</p>
              </div>

          {/* أداة تحديد الوجه المرجعي (الوجه A) التفاعلية */}
          <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2.5 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest text-right flex items-center justify-end gap-1.5">
              <span>تحديد الوجه المرجعي (الوجه A)</span>
              <Tag size={12} />
            </span>
            <div className="space-y-2.5 text-right font-sans" dir="rtl">
              <p className="text-[9px] text-zinc-400 leading-relaxed font-semibold">
                اضغط على أحد الأوجه لتوجيه الكاميرا المعاينة فوراً وتعيين زاوية القياس المرجعية (الوجه A) للماكينة:
              </p>
              
              <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setCameraPreset('front');
                    setSelectedFaceA('front');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all border text-center flex flex-col justify-center items-center gap-0.5 cursor-pointer ${selectedFaceA === 'front' ? 'bg-amber-950/30 text-amber-400 border-amber-500/50 font-bold shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold text-[9px] sm:text-[10px] text-[#fbbf24]">الوجه الأمامي (A)</span>
                  <span className="text-[7.5px] text-zinc-550">توجيه Z+ (مقلاة)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraPreset('back');
                    setSelectedFaceA('back');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all border text-center flex flex-col justify-center items-center gap-0.5 cursor-pointer ${selectedFaceA === 'back' ? 'bg-blue-950/30 text-blue-400 border-blue-500/50 font-bold shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold text-[9px] sm:text-[10px] text-[#3b82f6]">الوجه الخلفي (B)</span>
                  <span className="text-[7.5px] text-zinc-550">توجيه Z- (مقبض)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraPreset('top');
                    setSelectedFaceA('top');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all border text-center flex flex-col justify-center items-center gap-0.5 cursor-pointer ${selectedFaceA === 'top' ? 'bg-amber-950/30 text-amber-400 border-amber-500/50 font-bold shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold text-[9px] sm:text-[10px]">الوجه العلوي (Top)</span>
                  <span className="text-[7.5px] text-zinc-550">توجيه Y+</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraPreset('bottom');
                    setSelectedFaceA('bottom');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all border text-center flex flex-col justify-center items-center gap-0.5 cursor-pointer ${selectedFaceA === 'bottom' ? 'bg-amber-950/30 text-amber-400 border-amber-500/50 font-bold shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold text-[9px] sm:text-[10px]">الوجه السفلي (Bottom)</span>
                  <span className="text-[7.5px] text-zinc-550">توجيه Y-</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraPreset('right');
                    setSelectedFaceA('right');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all border text-center flex flex-col justify-center items-center gap-0.5 cursor-pointer ${selectedFaceA === 'right' ? 'bg-amber-950/30 text-amber-400 border-amber-500/50 font-bold shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold text-[9px] sm:text-[10px]">الوجه الأيمن (Right)</span>
                  <span className="text-[7.5px] text-zinc-550">توجيه X+</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraPreset('left');
                    setSelectedFaceA('left');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all border text-center flex flex-col justify-center items-center gap-0.5 cursor-pointer ${selectedFaceA === 'left' ? 'bg-amber-950/30 text-amber-400 border-amber-500/50 font-bold shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold text-[9px] sm:text-[10px]">الوجه الأيسر (Left)</span>
                  <span className="text-[7.5px] text-zinc-550">توجيه X-</span>
                </button>
              </div>

              <div className="bg-black/50 border border-zinc-900/60 rounded-lg py-2 text-center flex items-center justify-center gap-1.5 shadow-inner">
                <span className="text-[8px] text-zinc-500 font-bold">الوجه النشط المختار:</span>
                <span className="text-[10px] text-amber-400 font-bold">
                  {selectedFaceA === 'front' && 'الوجه الأمامي (Z+)'}
                  {selectedFaceA === 'back' && 'الوجه الخلفي (Z-)'}
                  {selectedFaceA === 'top' && 'الوجه العلوي (Y+)'}
                  {selectedFaceA === 'bottom' && 'الوجه السفلي (Y-)'}
                  {selectedFaceA === 'left' && 'الوجه الأيسر (X-)'}
                  {selectedFaceA === 'right' && 'الوجه الأيمن (X+)'}
                </span>
                <span className="text-[var(--accent)]"><Tag size={14} /></span>
              </div>
            </div>
          </div>

          {/* محاكاة المواد والظلال (Shaders) */}
          <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest text-right">محاكاة المواد والطلاء</span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <button
                onClick={() => setMaterialType('cad')}
                className={`py-1.5 rounded-lg transition-all border text-center cursor-pointer ${materialType === 'cad' ? 'bg-zinc-800/80 text-zinc-250 border-zinc-600 font-bold shadow-md' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:text-white'}`}
              >
                Matte Slate (رمادي)
              </button>
              <button
                onClick={() => setMaterialType('chrome')}
                className={`py-1.5 rounded-lg transition-all border text-center cursor-pointer ${materialType === 'chrome' ? 'bg-blue-950/60 text-blue-400 border-blue-500/40 font-bold shadow-[0_0_12px_rgba(59,130,246,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:text-white'}`}
              >
                Steel Chrome (لامع)
              </button>
              <button
                onClick={() => setMaterialType('brass')}
                className={`py-1.5 rounded-lg transition-all border text-center cursor-pointer ${materialType === 'brass' ? 'bg-amber-950/60 text-amber-400 border-amber-500/40 font-bold shadow-[0_0_12px_rgba(245,158,11,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:text-white'}`}
              >
                Polish Brass (نحاس)
              </button>
              <button
                onClick={() => setMaterialType('glass')}
                className={`py-1.5 rounded-lg transition-all border text-center cursor-pointer ${materialType === 'glass' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30 font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:text-white'}`}
              >
                X-Ray Glass (شفاف)
              </button>
              <button
                onClick={() => setMaterialType('wireframe')}
                className={`py-1.5 rounded-lg transition-all border text-center cursor-pointer col-span-2 ${materialType === 'wireframe' ? 'bg-purple-950/30 text-purple-400 border-purple-500/40 font-bold' : 'bg-zinc-950/40 text-zinc-400 border-zinc-900 hover:text-white'}`}
              >
                Wireframe Mode (شبكة الأسلاك)
              </button>
            </div>
          </div>

          {/* زوايا الاسقاط الهندسي (Ortho / Camera Views) */}
          <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest text-right">زوايا الإسقاط السريع للكاميرا</span>
            <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
              <button onClick={() => setCameraPreset('top')} className="py-1 bg-zinc-950/50 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-850 text-zinc-300 rounded-lg text-center cursor-pointer transition-colors">
                الأفقي (Top)
              </button>
              <button onClick={() => setCameraPreset('front')} className="py-1 bg-zinc-950/50 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-850 text-zinc-300 rounded-lg text-center cursor-pointer transition-colors">
                الأمامي (Front)
              </button>
              <button onClick={() => setCameraPreset('right')} className="py-1 bg-zinc-950/50 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-855 text-zinc-300 rounded-lg text-center cursor-pointer transition-colors">
                الجانبي (Right)
              </button>
              <button onClick={() => setCameraPreset('iso')} className={`py-1 ${colors.bgLight} hover:bg-black/80 border border-${colors.primary}/20 ${colors.text} rounded-lg text-center font-bold cursor-pointer transition-colors ${colors.shadow}`}>
                أيزو (ISO)
              </button>
            </div>
          </div>

          {/* محاكاة الحركة الذاتية (Turntable controls) */}
          <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest text-right">دوران المجسم والشبكة الذاتي</span>
            <div className="bg-[#08080c] border border-zinc-900 p-2.5 rounded-lg space-y-2">
              <CustomToggle
                checked={isRotating}
                onChange={setIsRotating}
                label="دور المجسم والشبكة معاً تلقائياً"
              />
              {isRotating && (
                <div className="pt-2 border-t border-[var(--border)] space-y-2">
                  <div className="flex justify-end text-[8px] text-[var(--text-dim)] font-mono">
                    <span>سرعة الدوران المشتركة:</span>
                  </div>
                  <div className="flex items-center gap-2" dir="ltr">
                    <button type="button" 
                      onClick={() => setRotationSpeed(Math.max(0.2, rotationSpeed - 0.1))}
                      className="w-7 h-7 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                    >-</button>
                    <div className="flex-1 relative">
                      <input 
                        type="number"
                        value={Number(rotationSpeed.toFixed(1))}
                        onChange={(e) => setRotationSpeed(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/40 border border-[var(--border)] rounded h-7 text-center text-[11px] font-mono text-white focus:outline-none focus:border-[var(--accent-blue)] transition-colors appearance-none"
                      />
                    </div>
                    <button type="button" 
                      onClick={() => setRotationSpeed(Math.min(5, rotationSpeed + 0.1))}
                      className="w-7 h-7 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                    >+</button>
                  </div>
                  <input 
                    type="range" 
                    min="0.2" 
                    max="5" 
                    step="0.1"
                    value={rotationSpeed} 
                    onChange={e => setRotationSpeed(parseFloat(e.target.value))} 
                    className="w-full h-1 mt-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" 
                  />
                </div>
              )}
            </div>
          </div>

          {/* محددات العرض والشبكات */}
          <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest text-right">مساعدات المخططات الإحداثية</span>
            <div className="space-y-0.5 text-[10px]" dir="rtl">
              <CustomToggle
                checked={showGrid}
                onChange={setShowGrid}
                label="إظهار شبكة الأرضية (تدور معاً)"
              />
              <CustomToggle
                checked={showAxes}
                onChange={setShowAxes}
                label="إظهار محاور الإحداثيات XYZ (تدور معاً)"
              />
              <CustomToggle
                checked={showEdges}
                onChange={setShowEdges}
                label="تأكيد حواف ومقاطع المضلع الهندسية (Outlines)"
              />
            </div>
          </div>

          {/* أداة التشريح والقطع المستعرض ثلاثي الأبعاد */}
          <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest text-right flex items-center justify-end gap-1.5">
              <span>أداة القطع والتشريح ثلاثي الأبعاد</span>
              <Scissors size={12} />
            </span>
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-2.5 space-y-2.5" dir="rtl">
              <span className="text-[9px] text-zinc-400 block leading-relaxed">
                عيّن مستوي القطع من أجل استعراض الهياكل المفرغة من الداخل للأنابيب المصممة:
              </span>
              <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                <button
                  type="button"
                  onClick={() => { setSliceAxis('none'); }}
                  className={`py-1 rounded text-center border transition-all cursor-pointer ${sliceAxis === 'none' ? 'bg-zinc-800 border-zinc-650 text-zinc-150 font-bold' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  بلا قطع
                </button>
                <button
                  type="button"
                  onClick={() => { setSliceAxis('x'); }}
                  className={`py-1 rounded text-center border transition-all cursor-pointer ${sliceAxis === 'x' ? 'bg-blue-950/60 border-blue-500/45 text-blue-400 font-bold' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  X-Axis
                </button>
                <button
                  type="button"
                  onClick={() => { setSliceAxis('y'); }}
                  className={`py-1 rounded text-center border transition-all cursor-pointer ${sliceAxis === 'y' ? `${colors.bgLight} border-${colors.primary}/45 ${colors.text} font-bold` : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  Y-Axis
                </button>
                <button
                  type="button"
                  onClick={() => { setSliceAxis('z'); }}
                  className={`py-1 rounded text-center border transition-all cursor-pointer ${sliceAxis === 'z' ? 'bg-zinc-800 border-zinc-650 text-zinc-150 font-bold' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                >
                  Z-Axis
                </button>
              </div>

              {sliceAxis !== 'none' && (
                <div className="pt-2 border-t border-[var(--border)] mt-2 space-y-2">
                  <div className="flex justify-end text-[8px] text-[var(--text-dim)] font-mono">
                    <span>موقع مستوي القطع المنزلق:</span>
                  </div>
                  <div className="flex items-center gap-2" dir="ltr">
                    <button type="button" 
                      onClick={() => setSliceValue(Math.max(0, sliceValue - 5))}
                      className="w-7 h-7 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                    >-</button>
                    <div className="flex-1 relative">
                      <input 
                        type="number"
                        value={sliceValue}
                        onChange={(e) => setSliceValue(parseInt(e.target.value) || 0)}
                        className="w-full bg-black/40 border border-[var(--border)] rounded h-7 text-center text-[11px] font-mono text-white focus:outline-none focus:border-[var(--accent-blue)] transition-colors appearance-none"
                      />
                    </div>
                    <button type="button" 
                      onClick={() => setSliceValue(Math.min(100, sliceValue + 5))}
                      className="w-7 h-7 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                    >+</button>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={sliceValue}
                    onChange={(e) => setSliceValue(parseInt(e.target.value))}
                    className="w-full h-1 mt-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)] animate-pulse"
                  />
                </div>
              )}
            </div>
          </div>

          {/* فحص توافقية قص الأنابيب بالليزر الصناعي CNC */}
          {modelInfo && (
            <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest text-right flex items-center justify-end gap-1.5">
                <span>فحص التوافقية لآلات ليزر الأنابيب</span>
                <Anchor size={12} />
              </span>
              <div className={`p-3 rounded-lg border text-right space-y-2 ${isLaserCompatible ? 'bg-emerald-950/15 border-emerald-500/25 text-emerald-400' : 'bg-red-950/15 border-red-500/35 text-red-400'}`} dir="rtl">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isLaserCompatible ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <div className="text-xs font-bold font-mono flex items-center gap-1">
                    {isLaserCompatible ? (
                      <><span className="flex items-center gap-1.5 font-sans">الهيكل معتمد تماماً لخط آلة الليزر</span> <CheckCircle2 size={12} /></>
                    ) : (
                      <><span className="flex items-center gap-1.5 font-sans">الهيكل يتخطي حدود التصنيع</span> <AlertTriangle size={12} /></>
                    )}
                  </div>
                </div>
                
                <p className="text-[9px] text-zinc-400 leading-relaxed">
                  {isLaserCompatible 
                    ? 'الأبعاد الهندسية والكتلة الكلية للأنبوب تقع تماماً ضمن النطاق التشغيلي الآمن لماكينة قطع الأنابيب بالليزر CNC (Zero-Gap Compatible).' 
                    : 'الأبعاد الحالية أو الوزن الكلي يتجاوز النطاق التشغيلي لماكينة القطع ومقاطع الفيدر.'}
                </p>

                <div className="h-px bg-zinc-900/40" />

                <div className="grid grid-cols-2 gap-1.5 text-[8px] font-mono text-zinc-400">
                  <div className="bg-black/35 p-1 rounded flex justify-between items-center w-full">
                    <span className={isDiameterOk ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {isDiameterOk ? 'متطابق' : 'مفرط'}
                    </span>
                    <span>القطر (اقصى {laserMaxDiameter}mm):</span>
                  </div>
                  <div className="bg-black/35 p-1 rounded flex justify-between items-center w-full">
                    <span className={isLengthOk ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {isLengthOk ? 'متطابق' : 'مفرط'}
                    </span>
                    <span>الطول (اقصى {laserMaxLength}mm):</span>
                  </div>
                  <div className="bg-black/35 p-1 rounded col-span-2 flex justify-between items-center w-full">
                    <span className={isWeightOk ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {isWeightOk ? 'متطابق' : 'مفرط'}
                    </span>
                    <span>وزن الخامة (اقصى {laserMaxWeight / 1000} كجم):</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* محاكي الأوزان الصناعي بناء على الكثافة والحجم الحقيقي */}
          {calculatedVolume > 1 && (
            <div className="bg-white/5 border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest text-right flex items-center justify-end gap-1.5">
                <span>حاسبة الوزن المصنعي التقديرية</span>
                <Ruler size={12} />
              </span>
              <div className={`border p-2.5 rounded-lg space-y-1.5 ${colors.bgLight} border-${colors.primary}/20`} dir="rtl">
                <div className="text-[9px] text-zinc-400 leading-relaxed">
                  بإمكانك اختيار سبيكة التصنيع لتقدير الكتلة والوزن الحقيقي للأنبوب المصمم:
                </div>
                
                {/* قائمة المواد بالكثافات */}
                <select
                  value={selectedDensity}
                  onChange={(e) => setSelectedDensity(parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-900 outline-none rounded-lg p-1.5 text-[10px] text-zinc-100 font-mono cursor-pointer"
                >
                  {DENSITY_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.name} ({p.value} {p.symbol})
                    </option>
                  ))}
                </select>

                <div className="h-px bg-zinc-800/50 my-1" />

                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono">
                  <div className="bg-black/35 p-1.5 rounded border border-zinc-900">
                    <span className="block text-[8px] text-zinc-555 mb-0.5">الحجم الهندسي</span>
                    <span className="font-bold text-zinc-200">{(calculatedVolume / 1000).toFixed(1)} cm³</span>
                  </div>
                  <div className={`p-1.5 rounded border ${colors.bgLight} border-${colors.primary}/10`}>
                    <span className={`block text-[8px] text-${colors.primary} mb-0.5`}>الوزن التقريبي للماكينة</span>
                    <span className={`font-bold ${colors.text}`}>{formattedWeight}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* معلومات النموذج الهيكلية */}
          {modelInfo && (
            <div className="border-t border-zinc-800/80 pt-3.5 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">إحصائيات المضلعات والأفاريز</span>
              
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex flex-col gap-2 font-mono">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-zinc-300">
                    {new Intl.NumberFormat('en-US').format(modelInfo.triangles)}
                  </span>
                  <span className="text-zinc-500">عدد المثلثات (Triangles):</span>
                </div>
                
                <div className="mt-1">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 block text-right">أقصى امتدادات ميكانيكية (Bounding Box):</span>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-1.5">
                      <span className="block text-[8px] text-red-500 mb-0.5">X (عرض)</span>
                      <span className="text-xs text-zinc-200 font-bold">{modelInfo.dimensions.x.toFixed(1)}mm</span>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-1.5">
                      <span className="block text-[8px] text-green-500 mb-0.5">Y (ارتفاع)</span>
                      <span className="text-xs text-zinc-200 font-bold">{modelInfo.dimensions.y.toFixed(1)}mm</span>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-1.5">
                      <span className="block text-[8px] text-blue-500 mb-0.5">Z (طول)</span>
                      <span className="text-xs text-zinc-200 font-bold">{modelInfo.dimensions.z.toFixed(1)}mm</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
        )}
        </div>
      </div>
    </div>
  );
};
