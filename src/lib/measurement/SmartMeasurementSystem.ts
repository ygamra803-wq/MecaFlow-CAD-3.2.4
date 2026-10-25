import * as THREE from 'three';
import { AdvancedTubeGeometry, TubeFace } from '../geometry/AdvancedTubeGeometry';

export interface Measurement {
  type: 'distance' | 'angle' | 'area' | 'volume' | 'weight' | 'perimeter' | 'curvature';
  value: number;
  points?: THREE.Vector3[];
  timestamp: Date;
  label: string;
}

export interface CameraPreset {
  name: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface ComparisonResult {
  measurement1: Measurement;
  measurement2: Measurement;
  difference: number;
  percentageDifference: number;
  isSimilar: boolean;
}

/**
 * نظام القياس الذكي المتقدم
 * يوفر قياسات دقيقة على جسم الأنبوب ثلاثي الأبعاد
 */
export class SmartMeasurementSystem {
  private tube: AdvancedTubeGeometry;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private selectedFace: TubeFace | null = null;
  private selectedPoints: THREE.Vector3[] = [];
  private measurements: Measurement[] = [];
  private measurementVisuals: THREE.Group = new THREE.Group();
  private activeCleanup: (() => void) | null = null;
  private currentMode: 'distance' | 'angle' | 'area' | 'perimeter' | 'curvature' | 'volume' | 'weight' | null = null;

  // الكاميرا الذكية
  private cameraPresets: CameraPreset[] = [
    {
      name: 'Front',
      position: new THREE.Vector3(0, 0, 200),
      target: new THREE.Vector3(0, 0, 0),
      fov: 50
    },
    {
      name: 'Top',
      position: new THREE.Vector3(0, 200, 0),
      target: new THREE.Vector3(0, 0, 0),
      fov: 50
    },
    {
      name: 'Side',
      position: new THREE.Vector3(200, 0, 0),
      target: new THREE.Vector3(0, 0, 0),
      fov: 50
    },
    {
      name: 'Perspective',
      position: new THREE.Vector3(150, 150, 150),
      target: new THREE.Vector3(0, 0, 0),
      fov: 50
    }
  ];

  constructor(tube: AdvancedTubeGeometry, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.tube = tube;
    this.scene = scene;
    this.camera = camera;
    this.scene.add(this.measurementVisuals);
  }

  /**
   * تحديد وجه من الأنبوب
   */
  selectFace(faceName: string): void {
    const faces = this.tube.getFaces();
    const face = faces.find(f => f.name === faceName);

    if (face) {
      this.selectedFace = face;
      this.tube.highlightFace(faceName);
      this.setSmartCamera(face);
      this.displayFaceInfo(face);
    }
  }

  /**
   * إزالة التحديد
   */
  deselectFace(): void {
    this.selectedFace = null;
    this.tube.unhighlightFace();
    this.selectedPoints = [];
    this.clearMeasurementVisuals();
  }

  /**
   * تعيين الكاميرا الذكية بناءً على الوجه المحدد
   */
  private setSmartCamera(face: TubeFace): void {
    let preset: CameraPreset | null = null;

    switch (face.name) {
      case 'front':
      case 'front_oval':
      case 'front_circle':
        preset = this.cameraPresets[0]; // Front
        break;
      case 'back':
      case 'back_oval':
      case 'back_circle':
        preset = this.cameraPresets[0]; // Front (معكوس)
        break;
      case 'top':
        preset = this.cameraPresets[1]; // Top
        break;
      case 'bottom':
        preset = this.cameraPresets[1]; // Top (معكوس)
        break;
      case 'left':
      case 'right':
        preset = this.cameraPresets[2]; // Side
        break;
      default:
        preset = this.cameraPresets[3]; // Perspective
    }

    if (preset) {
      this.animateCameraToPreset(preset);
    }
  }

  /**
   * تحريك الكاميرا بسلاسة إلى الموضع المحدد
   */
  private animateCameraToPreset(preset: CameraPreset, duration: number = 1000): void {
    const startPos = this.camera.position.clone();
    const endPos = preset.position;
    const startFov = this.camera.fov;
    const endFov = preset.fov;

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // تحريك الكاميرا
      this.camera.position.lerpVectors(startPos, endPos, progress);
      this.camera.fov = startFov + (endFov - startFov) * progress;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(preset.target);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * إضافة نقطة قياس
   */
  addMeasurementPoint(point: THREE.Vector3): void {
    this.selectedPoints.push(point);
    this.visualizePoint(point);

    if (this.currentMode === 'angle') {
      if (this.selectedPoints.length === 3) {
        this.measureAngle();
        this.selectedPoints = []; // إعادة تعيين
      }
    } else {
      // افتراض قياس المسافة عند نقرتين
      if (this.selectedPoints.length === 2) {
        this.measureDistance();
        this.selectedPoints = []; // إعادة تعيين
      }
    }
  }

  /**
   * قياس المسافة بين نقطتين
   */
  private measureDistance(): void {
    const p1 = this.selectedPoints[0];
    const p2 = this.selectedPoints[1];
    const distance = p1.distanceTo(p2);

    const measurement: Measurement = {
      type: 'distance',
      value: distance,
      points: [p1, p2],
      timestamp: new Date(),
      label: `المسافة: ${distance.toFixed(2)} ملم`
    };

    this.measurements.push(measurement);
    this.visualizeMeasurement(measurement);
    this.displayMeasurementInfo(measurement);
  }

  /**
   * قياس الزاوية بين ثلاث نقاط
   */
  private measureAngle(): void {
    const p1 = this.selectedPoints[0];
    const p2 = this.selectedPoints[1];
    const p3 = this.selectedPoints[2];

    // حساب المتجهات
    const v1 = p1.clone().sub(p2);
    const v2 = p3.clone().sub(p2);

    // حساب الزاوية
    const dotVal = v1.dot(v2) / (v1.length() * v2.length() + 1e-10);
    const angle = Math.acos(THREE.MathUtils.clamp(dotVal, -1, 1));
    const angleDegrees = THREE.MathUtils.radToDeg(angle);

    const measurement: Measurement = {
      type: 'angle',
      value: angleDegrees,
      points: [p1, p2, p3],
      timestamp: new Date(),
      label: `الزاوية: ${angleDegrees.toFixed(2)}°`
    };

    this.measurements.push(measurement);
    this.visualizeMeasurement(measurement);
    this.displayMeasurementInfo(measurement);
  }

  /**
   * قياس مساحة الوجه
   */
  measureFaceArea(): void {
    if (!this.selectedFace) return;

    const measurement: Measurement = {
      type: 'area',
      value: this.selectedFace.area,
      points: this.selectedFace.points,
      timestamp: new Date(),
      label: `المساحة: ${this.selectedFace.area.toFixed(2)} ملم²`
    };

    this.measurements.push(measurement);
    this.displayMeasurementInfo(measurement);
  }

  /**
   * قياس الحجم الكلي
   */
  measureVolume(): void {
    const properties = this.tube.getProperties();
    const volume = properties.volume || 0;

    const measurement: Measurement = {
      type: 'volume',
      value: volume,
      timestamp: new Date(),
      label: `الحجم: ${volume.toFixed(2)} ملم³ (${(volume / 1000).toFixed(2)} سم³)`
    };

    this.measurements.push(measurement);
    this.displayMeasurementInfo(measurement);
  }

  /**
   * قياس الوزن
   */
  measureWeight(): void {
    const properties = this.tube.getProperties();
    const weight = properties.weight || 0;

    const measurement: Measurement = {
      type: 'weight',
      value: weight,
      timestamp: new Date(),
      label: `الوزن: ${weight.toFixed(2)} كجم`
    };

    this.measurements.push(measurement);
    this.displayMeasurementInfo(measurement);
  }

  /**
   * قياس محيط الوجه
   */
  measurePerimeter(): void {
    if (!this.selectedFace) return;

    let perimeter = 0;
    const points = this.selectedFace.points;

    for (let i = 0; i < points.length - 1; i++) {
      perimeter += points[i].distanceTo(points[i + 1]);
    }

    const measurement: Measurement = {
      type: 'perimeter',
      value: perimeter,
      points,
      timestamp: new Date(),
      label: `المحيط: ${perimeter.toFixed(2)} ملم`
    };

    this.measurements.push(measurement);
    this.displayMeasurementInfo(measurement);
  }

  /**
   * قياس الانحناء (Curvature)
   */
  measureCurvature(): void {
    if (!this.selectedFace || this.selectedFace.type !== 'curved') {
      console.warn('الوجه المحدد ليس منحنياً');
      return;
    }

    const points = this.selectedFace.points;
    if (points.length < 3) return;

    // حساب الانحناء عند النقطة الوسطية
    const p1 = points[0];
    const p2 = points[Math.floor(points.length / 2)];
    const p3 = points[points.length - 1];

    const curvature = this.calculateCurvature(p1, p2, p3);

    const measurement: Measurement = {
      type: 'curvature',
      value: curvature,
      points: [p1, p2, p3],
      timestamp: new Date(),
      label: `الانحناء: ${curvature.toFixed(4)} ملم⁻¹`
    };

    this.measurements.push(measurement);
    this.displayMeasurementInfo(measurement);
  }

  /**
   * حساب الانحناء
   */
  private calculateCurvature(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): number {
    const v1 = p2.clone().sub(p1);
    const v2 = p3.clone().sub(p2);

    const cross = v1.clone().cross(v2);
    const numerator = cross.length();
    const denominator = v1.length() * v2.length() * p1.distanceTo(p3);

    return numerator / (denominator + 1e-10);
  }

  /**
   * تصور نقطة القياس
   */
  private visualizePoint(point: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(2, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(point);

    this.measurementVisuals.add(sphere);
  }

  /**
   * تصور القياس
   */
  private visualizeMeasurement(measurement: Measurement): void {
    if (measurement.type === 'distance' && measurement.points && measurement.points.length === 2) {
      // رسم خط بين النقطتين
      const geometry = new THREE.BufferGeometry().setFromPoints([measurement.points[0], measurement.points[1]]);
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
      const line = new THREE.Line(geometry, material);

      this.measurementVisuals.add(line);
    }
  }

  /**
   * عرض معلومات الوجه
   */
  private displayFaceInfo(face: TubeFace): void {
    console.log(`Face Name: ${face.name}, Area: ${face.area}`);
  }

  /**
   * عرض معلومات القياس
   */
  private displayMeasurementInfo(measurement: Measurement): void {
    console.log(`Measurement type: ${measurement.type}, Label: ${measurement.label}`);
  }

  /**
   * إزالة تصورات القياس
   */
  clearMeasurementVisuals(): void {
    this.measurementVisuals.clear();
  }

  /**
   * الحصول على جميع القياسات
   */
  getMeasurements(): Measurement[] {
    return this.measurements;
  }

  /**
   * حفظ القياسات
   */
  saveMeasurements(): string {
    return JSON.stringify(this.measurements, null, 2);
  }

  /**
   * مقارنة القياسات
   */
  compareMeasurements(measurement1: Measurement, measurement2: Measurement): ComparisonResult {
    const difference = Math.abs(measurement1.value - measurement2.value);
    const percentageDifference = (difference / (measurement1.value + 1e-10)) * 100;

    return {
      measurement1,
      measurement2,
      difference,
      percentageDifference,
      isSimilar: percentageDifference < 5 // أقل من 5% فرق
    };
  }

  /**
   * تعيين الكاميرا المسبقة
   */
  setCameraPreset(presetName: string): void {
    const preset = this.cameraPresets.find(p => p.name === presetName);
    if (preset) {
      this.animateCameraToPreset(preset);
    }
  }

  /**
   * الحصول على جميع الكاميرات المسبقة
   */
  getCameraPresets(): CameraPreset[] {
    return this.cameraPresets;
  }

  /**
   * تنظيف الموارد
   */
  dispose(): void {
    if (this.activeCleanup) {
      this.activeCleanup();
      this.activeCleanup = null;
    }
    this.clearMeasurementVisuals();
    this.scene.remove(this.measurementVisuals);
  }

  public setMeasurementMode(mode: 'distance' | 'angle' | 'area' | 'perimeter' | 'curvature' | 'volume' | 'weight' | null): void {
    this.currentMode = mode;
    this.selectedPoints = [];
  }

  public getMeasurementMode(): string | null {
    return this.currentMode;
  }

  /**
   * ربط اختيار النقاط بنقرات الفأرة على مساحة الرسم ثلاثية الأبعاد
   */
  public enablePointSelection(canvas: HTMLCanvasElement, onPointAdded?: () => void): () => void {
    // Clean up active listener if any
    if (this.activeCleanup) {
      this.activeCleanup();
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

      // Only perform raycast if it is a discrete click (not a camera drag/pan movement)
      if (dist < 5) {
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Raycast against the main mesh
        const mesh = this.tube.getMesh();
        const intersects = raycaster.intersectObject(mesh);

        if (intersects.length > 0) {
          const point = intersects[0].point;
          this.addMeasurementPoint(point);
          if (onPointAdded) {
            onPointAdded();
          }
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });

    const cleanup = () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };

    this.activeCleanup = cleanup;
    return cleanup;
  }
}
