import { ZeroGapState, WizardStep } from '../types';
import * as THREE from 'three';

export interface GCodeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * محرك توليد وفحص G-code المتقدم للماكينات متعددة المحاور (NCCSTUDIO V15)
 */
export class GCodeGenerator {
  static generatePoints(config: ZeroGapState, wizardStep: WizardStep): { panPoints3D: THREE.Vector3[], handlePoints3D: THREE.Vector3[] } {
    const numPoints = 180;
    const tw = config.tube.width;
    const th = config.tube.shape === 'دائري' ? tw : (config.tube.height || tw);
    const tl = config.tube.totalLength;
    const wt = config.pan.wallThickness || 2.0;
    const rBottom = config.pan.innerMoldMode
      ? config.pan.bottomDiameter / 2.0 + wt
      : config.pan.bottomDiameter / 2.0;
    const rTop = config.pan.innerMoldMode
      ? config.pan.topDiameter / 2.0 + wt
      : config.pan.topDiameter / 2.0;
    const H = config.pan.height;

    const tiltAngle = config.assembly.tiltAngle || 0;
    const angleRad = tiltAngle * (Math.PI / 180);
    const tubeRoll = (config.assembly.handleAngleY || 0) * (Math.PI / 180);
    const heightOffset = config.assembly.heightOffset || 0;
    const insertion = config.assembly.insertionDistance || 0;
    const hInsertion = config.handle.insertionDepth || 15;

    const isStep5 = wizardStep === 'tube-handle-cut' || wizardStep === 'technical-review' || wizardStep === 'final-inspect';
    const tubeZPos = isStep5 ? (-tl + hInsertion / 2) : -(insertion / 2);
    const panZOffset = isStep5 ? (tubeZPos + insertion) : (insertion / 2);
    const panY = -(heightOffset || 0);

    const rTopActual = config.pan.innerMoldMode
      ? config.pan.topDiameter / 2 + wt
      : config.pan.topDiameter / 2;
    const rimThick = config.pan.rimThickness || 2.0;
    const pBoundZ = rTopActual + (config.pan.addRim ? rimThick : 0);

    const evaluatePanDistance = (z: number, phi: number) => {
      const x_t = (tw / 2) * Math.cos(phi);
      const y_t = (th / 2) * Math.sin(phi);

      const x_p = x_t;
      const y_p = y_t;
      const z_p = z;

      const x_a = x_p;
      const y_a = y_p * Math.cos(angleRad) - z_p * Math.sin(angleRad);
      const z_a = y_p * Math.sin(angleRad) + z_p * Math.cos(angleRad);

      const x_rot = x_a * Math.cos(tubeRoll) - y_a * Math.sin(tubeRoll);
      const y_rot = x_a * Math.sin(tubeRoll) + y_a * Math.cos(tubeRoll);
      const z_rot = z_a;

      const x_world = x_rot;
      const y_world = y_rot;
      const z_world = z_rot + tubeZPos;

      const x_pan = x_world;
      const y_pan = y_world - panY;
      const z_pan = z_world - (-pBoundZ + panZOffset);

      const r_pt = Math.hypot(x_pan, z_pan);
      const r_cone = rBottom + ((rTop - rBottom) / H) * Math.max(0, Math.min(H, y_pan));

      return r_pt - r_cone;
    };

    const evaluateHandleDistance = (z: number, phi: number) => {
      const x_t = (tw / 2) * Math.cos(phi);
      const y_t = (th / 2) * Math.sin(phi);
      const z_t = z - tl / 2;

      const hCfg = config.handle;
      const hOffsetZ = hCfg.offsetZ || 0;

      const dx = x_t - hOffsetZ;
      const dy = y_t;
      const dz = z_t - (tl / 2 - hInsertion);

      const alpha = (hCfg.angleX || 0) * (Math.PI / 180);
      const beta = (hCfg.angleY || 0) * (Math.PI / 180);

      const x1 = dx * Math.cos(-beta) + dz * Math.sin(-beta);
      const y1 = dy;
      const z1 = -dx * Math.sin(-beta) + dz * Math.cos(-beta);

      const x2 = x1;
      const y2 = y1 * Math.cos(-alpha) - z1 * Math.sin(-alpha);
      const z2 = y1 * Math.sin(-alpha) + z1 * Math.cos(-alpha);

      const hBoundZ = (hCfg.depth || 80) / 2;
      const x_handle = x2;
      const y_handle = y2;
      const z_handle = z2 - hBoundZ;

      if (hCfg.shape === 'cylindrical') {
        const outerR = hCfg.width / 2;
        const d_rad = Math.hypot(x_handle, y_handle) - outerR;
        const d_z = Math.abs(z_handle) - (hCfg.depth || 80) / 2;
        return Math.max(d_rad, d_z);
      } else {
        const hw = hCfg.width || 30;
        const hh = hCfg.height || 20;
        const depth = hCfg.depth || 80;
        const hr = Math.min(hCfg.cornerRadius || 3, hw / 2, hh / 2);

        const sx = Math.abs(x_handle) - (hw / 2 - hr);
        const sy = Math.abs(y_handle) - (hh / 2 - hr);
        let d2d = 0;
        if (sx > 0 && sy > 0) {
          d2d = Math.hypot(sx, sy) - hr;
        } else if (sx > 0) {
          d2d = sx - hr;
        } else if (sy > 0) {
          d2d = sy - hr;
        } else {
          d2d = Math.max(sx, sy) - hr;
        }

        const d_z = Math.abs(z_handle) - depth / 2;
        return Math.max(d2d, d_z);
      }
    };

    const panPoints: { x: number, a: number, zRaw: number, phi: number }[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const phi = (i / numPoints) * 2 * Math.PI;
      let low = 0;
      let high = tl;
      let z_sol = -1;
      let f_low = evaluatePanDistance(low, phi);
      let f_high = evaluatePanDistance(high, phi);

      if (f_low * f_high > 0) {
        const steps = 60;
        for (let s = 1; s < steps; s++) {
          const testZ = (s / steps) * tl;
          const f_test = evaluatePanDistance(testZ, phi);
          if (f_test * f_low <= 0) {
            high = testZ;
            f_high = f_test;
            break;
          }
        }
      }

      if (f_low * f_high <= 0) {
        for (let iter = 0; iter < 24; iter++) {
          const mid = (low + high) / 2;
          const f_mid = evaluatePanDistance(mid, phi);
          if (f_mid === 0) {
            low = mid;
            high = mid;
            break;
          }
          if (f_mid * f_low > 0) {
            low = mid;
            f_low = f_mid;
          } else {
            high = mid;
            f_high = f_mid;
          }
        }
        z_sol = (low + high) / 2;
      }

      let a_deg = phi * (180 / Math.PI);
      if (a_deg < 0) a_deg += 360;
      const zRaw = z_sol >= 0 && z_sol <= tl ? z_sol : insertion;
      panPoints.push({ x: zRaw, a: a_deg, zRaw, phi });
    }

    const handlePoints: { x: number, a: number, zRaw: number, phi: number }[] = [];
    if (config.fallbackCutToDepth !== false || config.handle.shape) {
      for (let i = 0; i <= numPoints; i++) {
        const phi = (i / numPoints) * 2 * Math.PI;
        let low = 0;
        let high = tl;
        let z_sol = -1;
        let f_low = evaluateHandleDistance(low, phi);
        let f_high = evaluateHandleDistance(high, phi);

        if (f_low * f_high > 0) {
          const steps = 60;
          for (let s = 1; s < steps; s++) {
            const testZ = (s / steps) * tl;
            const f_test = evaluateHandleDistance(testZ, phi);
            if (f_test * f_low <= 0) {
              high = testZ;
              f_high = f_test;
              break;
            }
          }
        }

        if (f_low * f_high <= 0) {
          for (let iter = 0; iter < 24; iter++) {
            const mid = (low + high) / 2;
            const f_mid = evaluateHandleDistance(mid, phi);
            if (f_mid === 0) {
              low = mid;
              high = mid;
              break;
            }
            if (f_mid * f_low > 0) {
              low = mid;
              f_low = f_mid;
            } else {
              high = mid;
              f_high = f_mid;
            }
          }
          z_sol = (low + high) / 2;
        }

        let a_deg = phi * (180 / Math.PI);
        if (a_deg < 0) a_deg += 360;
        const zRaw = z_sol >= 0 && z_sol <= tl ? z_sol : (tl - hInsertion);
        handlePoints.push({ x: zRaw, a: a_deg, zRaw, phi });
      }
    }

    const to3D = (pt: { phi: number, zRaw: number }) => {
      // Create local 3D points on the tube (before any tubePivot transform, since they will be child of tubeMesh)
      // Actually, since ToolpathPreview will be placed at scene level or tube level?
      // If we put ToolpathPreview as a child of the tubeMesh, its local coordinates should match the tube's geometry exactly.
      // Tube base geometry extends from z=0 to z=tl centered. 
      // In ThreeCanvas, `tubeMesh.geometry.translate(0, 0, tl / 2)` was used or wait, Tube geometry is locally Z around origin initially?
      // "const z_t = z - tl / 2;" in evaluateHandleDistance suggests the local tube coordinate system has Z=0 at its middle.
      // Wait, in ThreeCanvas, standard TubeGeometry might be centered.
      
      const px = (tw / 2) * Math.cos(pt.phi);
      const py = (th / 2) * Math.sin(pt.phi);
      // Let's use local coordinates w.r.t tube mesh center.
      // Inside evaluateHandleDistance: `z_t = z - tl / 2;`
      // So z_t goes from -tl/2 to +tl/2. Let's return local points:
      const pz = pt.zRaw - (tl / 2);
      
      return new THREE.Vector3(px, py, pz);
    };

    return {
      panPoints3D: panPoints.map(to3D),
      handlePoints3D: handlePoints.map(to3D)
    };
  }

  /**
   * توليد كود الـ G-code بدقة صناعية وحساب الوقت الفعلي
   */
  static generateGCode(
    config: ZeroGapState,
    wizardStep: WizardStep,
    opts?: { feedRate?: number; spindleSpeed?: number; safetyHeight?: number }
  ): {
    gcode: string;
    validation: GCodeValidationResult;
    estimatedTime: number;
    error?: string;
  } {
    const feed = opts?.feedRate || 1200;
    const spindle = opts?.spindleSpeed || 1500;
    const sHeight = opts?.safetyHeight || 5.0;

    const panPoints: { x: number, a: number }[] = [];
    const handlePoints: { x: number, a: number }[] = [];
    const numPoints = 180; // Smooth 2-degree step for high-precision
    
    const tw = config.tube.width;
    const th = config.tube.shape === 'دائري' ? tw : (config.tube.height || tw);
    const tl = config.tube.totalLength;
    // حساب تفاصيل المقلاة لتوافق كامل مع المعاينة الـ 3D
    const wt = config.pan.wallThickness || 2.0;
    const rBottom = config.pan.innerMoldMode
      ? config.pan.bottomDiameter / 2.0 + wt
      : config.pan.bottomDiameter / 2.0;
    const rTop = config.pan.innerMoldMode
      ? config.pan.topDiameter / 2.0 + wt
      : config.pan.topDiameter / 2.0;
    const H = config.pan.height;

    const tiltAngle = config.assembly.tiltAngle || 0;
    const angleRad = tiltAngle * (Math.PI / 180);
    const tubeRoll = (config.assembly.handleAngleY || 0) * (Math.PI / 180);
    const heightOffset = config.assembly.heightOffset || 0;
    const insertion = config.assembly.insertionDistance || 0;
    const hInsertion = config.handle.insertionDepth || 15;

    const isStep5 = wizardStep === 'tube-handle-cut' || wizardStep === 'technical-review' || wizardStep === 'final-inspect';
    const tubeZPos = isStep5 ? (-tl + hInsertion / 2) : -(insertion / 2);
    const panZOffset = isStep5 ? (tubeZPos + insertion) : (insertion / 2);
    const panY = -(heightOffset || 0);

    const rTopActual = config.pan.innerMoldMode
      ? config.pan.topDiameter / 2 + wt
      : config.pan.topDiameter / 2;
    const rimThick = config.pan.rimThickness || 2.0;
    const pBoundZ = rTopActual + (config.pan.addRim ? rimThick : 0);

    // 1. المسافة لحساب التقاطع مع المقلاة (الوجه A)
    const evaluatePanDistance = (z: number, phi: number) => {
      const x_t = (tw / 2) * Math.cos(phi);
      const y_t = (th / 2) * Math.sin(phi);

      const x_p = x_t;
      const y_p = y_t;
      const z_p = z;

      // تطبيق الميلان Pitch
      const x_a = x_p;
      const y_a = y_p * Math.cos(angleRad) - z_p * Math.sin(angleRad);
      const z_a = y_p * Math.sin(angleRad) + z_p * Math.cos(angleRad);

      // تطبيق الالتواء Roll
      const x_rot = x_a * Math.cos(tubeRoll) - y_a * Math.sin(tubeRoll);
      const y_rot = x_a * Math.sin(tubeRoll) + y_a * Math.cos(tubeRoll);
      const z_rot = z_a;

      const x_world = x_rot;
      const y_world = y_rot;
      const z_world = z_rot + tubeZPos;

      const x_pan = x_world;
      const y_pan = y_world - panY;
      const z_pan = z_world - (-pBoundZ + panZOffset);

      const r_pt = Math.hypot(x_pan, z_pan);
      const r_cone = rBottom + ((rTop - rBottom) / H) * Math.max(0, Math.min(H, y_pan));

      return r_pt - r_cone;
    };

    // 2. المسافة لحساب التقاطع مع المقبض (الوجه B)
    const evaluateHandleDistance = (z: number, phi: number) => {
      const x_t = (tw / 2) * Math.cos(phi);
      const y_t = (th / 2) * Math.sin(phi);
      const z_t = z - tl / 2;

      const hCfg = config.handle;
      const hOffsetZ = hCfg.offsetZ || 0;

      const dx = x_t - hOffsetZ;
      const dy = y_t;
      const dz = z_t - (tl / 2 - hInsertion);

      // مصفوفة الدوران العكسية
      const alpha = (hCfg.angleX || 0) * (Math.PI / 180);
      const beta = (hCfg.angleY || 0) * (Math.PI / 180);

      const x1 = dx * Math.cos(-beta) + dz * Math.sin(-beta);
      const y1 = dy;
      const z1 = -dx * Math.sin(-beta) + dz * Math.cos(-beta);

      const x2 = x1;
      const y2 = y1 * Math.cos(-alpha) - z1 * Math.sin(-alpha);
      const z2 = y1 * Math.sin(-alpha) + z1 * Math.cos(-alpha);

      const hBoundZ = (hCfg.depth || 80) / 2;
      const x_handle = x2;
      const y_handle = y2;
      const z_handle = z2 - hBoundZ;

      if (hCfg.shape === 'cylindrical') {
        const outerR = hCfg.width / 2;
        const d_rad = Math.hypot(x_handle, y_handle) - outerR;
        const d_z = Math.abs(z_handle) - (hCfg.depth || 80) / 2;
        return Math.max(d_rad, d_z);
      } else {
        const hw = hCfg.width || 30;
        const hh = hCfg.height || 20;
        const depth = hCfg.depth || 80;
        const hr = Math.min(hCfg.cornerRadius || 3, hw / 2, hh / 2);

        const sx = Math.abs(x_handle) - (hw / 2 - hr);
        const sy = Math.abs(y_handle) - (hh / 2 - hr);
        let d2d = 0;
        if (sx > 0 && sy > 0) {
          d2d = Math.hypot(sx, sy) - hr;
        } else if (sx > 0) {
          d2d = sx - hr;
        } else if (sy > 0) {
          d2d = sy - hr;
        } else {
          d2d = Math.max(sx, sy) - hr;
        }

        const d_z = Math.abs(z_handle) - depth / 2;
        return Math.max(d2d, d_z);
      }
    };

    // حل تقاطع المقلاة والوجه A
    for (let i = 0; i < numPoints; i++) {
      const phi = (i / numPoints) * 2 * Math.PI;
      let low = 0;
      let high = tl;
      let z_sol = -1;
      let f_low = evaluatePanDistance(low, phi);
      let f_high = evaluatePanDistance(high, phi);

      if (f_low * f_high > 0) {
        const steps = 60;
        for (let s = 1; s < steps; s++) {
          const testZ = (s / steps) * tl;
          const f_test = evaluatePanDistance(testZ, phi);
          if (f_test * f_low <= 0) {
            high = testZ;
            f_high = f_test;
            break;
          }
        }
      }

      if (f_low * f_high <= 0) {
        for (let iter = 0; iter < 24; iter++) {
          const mid = (low + high) / 2;
          const f_mid = evaluatePanDistance(mid, phi);
          if (f_mid === 0) {
            low = mid;
            high = mid;
            break;
          }
          if (f_mid * f_low > 0) {
            low = mid;
            f_low = f_mid;
          } else {
            high = mid;
            f_high = f_mid;
          }
        }
        z_sol = (low + high) / 2;
      }

      let a_deg = phi * (180 / Math.PI);
      if (a_deg < 0) a_deg += 360;

      if (z_sol >= 0 && z_sol <= tl) {
        panPoints.push({ x: z_sol, a: a_deg });
      } else {
        panPoints.push({ x: insertion, a: a_deg });
      }
    }

    // حل تقاطع المقبض والوجه B
    for (let i = 0; i < numPoints; i++) {
      const phi = (i / numPoints) * 2 * Math.PI;
      let low = 0;
      let high = tl;
      let z_sol = -1;
      let f_low = evaluateHandleDistance(low, phi);
      let f_high = evaluateHandleDistance(high, phi);

      if (f_low * f_high > 0) {
        const steps = 60;
        for (let s = 1; s < steps; s++) {
          const testZ = (s / steps) * tl;
          const f_test = evaluateHandleDistance(testZ, phi);
          if (f_test * f_low <= 0) {
            high = testZ;
            f_high = f_test;
            break;
          }
        }
      }

      if (f_low * f_high <= 0) {
        for (let iter = 0; iter < 24; iter++) {
          const mid = (low + high) / 2;
          const f_mid = evaluateHandleDistance(mid, phi);
          if (f_mid === 0) {
            low = mid;
            high = mid;
            break;
          }
          if (f_mid * f_low > 0) {
            low = mid;
            f_low = f_mid;
          } else {
            high = mid;
            f_high = f_mid;
          }
        }
        z_sol = (low + high) / 2;
      }

      let a_deg = phi * (180 / Math.PI);
      if (a_deg < 0) a_deg += 360;

      if (z_sol >= 0 && z_sol <= tl) {
        handlePoints.push({ x: z_sol, a: a_deg });
      } else {
        if (config.fallbackCutToDepth !== false) {
          handlePoints.push({ x: tl - hInsertion, a: a_deg });
        }
      }
    }

    panPoints.sort((p1, p2) => p1.a - p2.a);
    handlePoints.sort((p1, p2) => p1.a - p2.a);

    const pPointsUnique: typeof panPoints = [];
    for (const pt of panPoints) {
      if (pPointsUnique.length === 0 || Math.abs(pt.a - pPointsUnique[pPointsUnique.length - 1].a) > 0.01) {
        pPointsUnique.push(pt);
      }
    }

    const hPointsUnique: typeof handlePoints = [];
    for (const pt of handlePoints) {
      if (hPointsUnique.length === 0 || Math.abs(pt.a - hPointsUnique[hPointsUnique.length - 1].a) > 0.01) {
        hPointsUnique.push(pt);
      }
    }

    const isFallbackEnabled = config.fallbackCutToDepth !== false;
    if (pPointsUnique.length < 12) {
      return {
        gcode: '',
        validation: { isValid: false, errors: ['خطأ في معالجة نقاط التقاطع للأنبوب والمقلاة.'], warnings: [] },
        estimatedTime: 0,
        error: "خطأ في معالجة نقاط التقاطع للأنبوب والمقلاة. يرجى مراجعة قيم التصميم وزوايا الاتصال."
      };
    }
    if (isFallbackEnabled && hPointsUnique.length < 12) {
      return {
        gcode: '',
        validation: { isValid: false, errors: ['خطأ في معالجة نقاط تقاطع المقبض.'], warnings: [] },
        estimatedTime: 0,
        error: "خطأ في معالجة نقاط التقاط لمقبض الأنبوب. يرجى تفعيل القص التلقائي المسطح (Continuous Fallback) أو تعديل قطر المقبض."
      };
    }

    const lines: string[] = [];
    lines.push('%');
    lines.push(`O2000 (MECAFLOW-CAD V2.3 ZERO-GAP INDUSTRIAL G-CODE)`);
    lines.push(`(Generated directly by MecaFlow Machine Interface)`);
    lines.push(`(Date: ${new Date().toISOString().split('T')[0]} - Time: ${new Date().toLocaleTimeString('ar-EG')})`);
    lines.push(`(Laser Power: 1500W, Auxiliary Gas: O2)`);
    lines.push(`(TUBE OUTER BOUNDS: ${tw}mm x ${th}mm, LENGTH: ${tl}mm)`);
    lines.push(`(PAN BOTTOM: ${config.pan.bottomDiameter}mm, TOP: ${config.pan.topDiameter}mm)`);
    lines.push(`(HANDLE WIDTH: ${config.handle.width}mm, DEPTH: ${config.handle.depth}mm)`);
    lines.push('');

    // Pre-execution codes
    lines.push('G17 (XY Plane Selection)');
    lines.push('G90 (Absolute Positioning)');
    lines.push('G21 (Units in Millimeters)');
    lines.push(`F${feed} (Set Feedrate in mm/min)`);
    lines.push(`S${spindle} (Set Spindle / Laser Intensity)`);
    lines.push('');

    let estimatedTime = 0;

    // Cut 1: Pan profile at End A
    lines.push('(-------------------------------------------)');
    lines.push('(CUT 1: PAN PROFILE AT END A)');
    lines.push('(-------------------------------------------)');
    lines.push('M05 (Laser OFF)');
    lines.push(`G00 X${pPointsUnique[0].x.toFixed(4)} A${pPointsUnique[0].a.toFixed(4)}`);
    lines.push('M03 (Laser ON)');
    lines.push('G04 P0.5 (Dwell 0.5s to pierce metal)');

    let currentPos = new THREE.Vector3(pPointsUnique[0].x, 0, pPointsUnique[0].a);
    for (const pt of pPointsUnique) {
      lines.push(`G01 X${pt.x.toFixed(4)} A${pt.a.toFixed(4)}`);
      // حساب مسافة القطع ثلاثية الأبعاد التراكمية لحساب زمن الإنجاز
      const dist = Math.hypot(pt.x - currentPos.x, (pt.a - currentPos.z) * (Math.PI / 180) * (tw / 2));
      estimatedTime += (dist / feed) * 60; // seconds
      currentPos.set(pt.x, 0, pt.a);
    }
    // إغلاق المنحنى الأول بالعودة لنقاط البداية
    lines.push(`G01 X${pPointsUnique[0].x.toFixed(4)} A${pPointsUnique[0].a.toFixed(4)}`);
    lines.push('M05 (Laser OFF)');
    lines.push('');

    // Cut 2: Handle profile at End B
    if (hPointsUnique.length >= 3) {
      lines.push('(-------------------------------------------)');
      lines.push('(CUT 2: HANDLE PROFILE AT END B)');
      lines.push('(-------------------------------------------)');
      lines.push('M05 (Laser OFF)');
      lines.push(`G00 X${hPointsUnique[0].x.toFixed(4)} A${hPointsUnique[0].a.toFixed(4)}`);
      lines.push('M03 (Laser ON)');
      lines.push('G04 P0.5 (Dwell 0.5s to pierce metal)');

      currentPos.set(hPointsUnique[0].x, 0, hPointsUnique[0].a);
      for (const pt of hPointsUnique) {
        lines.push(`G01 X${pt.x.toFixed(4)} A${pt.a.toFixed(4)}`);
        const dist = Math.hypot(pt.x - currentPos.x, (pt.a - currentPos.z) * (Math.PI / 180) * (tw / 2));
        estimatedTime += (dist / feed) * 60; // seconds
        currentPos.set(pt.x, 0, pt.a);
      }
      lines.push(`G01 X${hPointsUnique[0].x.toFixed(4)} A${hPointsUnique[0].a.toFixed(4)}`);
      lines.push('M05 (Laser OFF)');
      lines.push('');
    }

    lines.push(`G00 Z${sHeight.toFixed(3)} (Safety Height to clear part)`);
    lines.push('M30 (Program End)');
    lines.push('%');

    const gcode = lines.join('\n');
    const validation = this.validateGCode(gcode);

    return {
      gcode,
      validation,
      estimatedTime: estimatedTime / 60, // direct minutes conversion
    };
  }

  /**
   * الفحص الشامل لسلامة سكريبت G-code وتجنب الحوادث الصناعية
   */
  static validateGCode(gcode: string): GCodeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = gcode.split('\n');

    let hasM03 = false;
    let hasM05 = false;
    let hasM30 = false;
    let feedRateSet = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || line.startsWith('(') || line.startsWith('%')) continue;

      if (line.includes('M03') || line.includes('M3')) hasM03 = true;
      if (line.includes('M05') || line.includes('M5')) hasM05 = true;
      if (line.includes('M30')) hasM30 = true;

      // فحص السرعة
      const fMatch = line.match(/F(\d+)/);
      if (fMatch) {
        feedRateSet = true;
        const currentFeed = parseInt(fMatch[1], 10);
        if (currentFeed > 5000) {
          warnings.push(`السطر ${i + 1}: سرعة تغذية عالية جداً (${currentFeed}) قد تؤدي لضعف دقة القطع في ماكينات الألياف الضوئية`);
        }
      }

      if (line.includes('G01') && !feedRateSet) {
        warnings.push(`السطر ${i + 1}: تم تشغيل حركة قطع خطي G01 دون تهيئة مسبقة لسرعة التغذية (F)`);
      }
    }

    if (!hasM03) errors.push('لا يوجد في الملف أمر تشغيل شعاع الليزر (M03)');
    if (!hasM05) errors.push('لا يوجد في الملف أمر إيقاف شعاع الليزر (M05)');
    if (!hasM30) errors.push('لا يوجد في الملف أمر نهاية البرنامج الإلزامي (M30)');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * التوافقية الكاملة للواجهة الحالية
 */
export const generateGcode = (config: ZeroGapState, wizardStep: WizardStep): { gcode: string; error?: string } => {
  const result = GCodeGenerator.generateGCode(config, wizardStep);
  if (result.error) {
    return { gcode: '', error: result.error };
  }
  return { gcode: result.gcode };
};
