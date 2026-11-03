import { ZeroGapState, WizardStep, PanConfig } from '../types';
import * as THREE from 'three';

export interface GCodeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * محرك توليد وفحص G-code المتقدم للماكينات متعددة المحاور (NCCSTUDIO V15)
 * متطابق هندسياً بنسبة 100% مع محرك CSG ثلاثي الأبعاد لجميع أشكال الأنابيب والمقالي والمقابض
 */
export class GCodeGenerator {
  /**
   * حساب الطول الفعلي للأنبوب حسب المرحلة الحالية (مطابق تماماً لـ ThreeCanvas)
   */
  static getEffectiveTubeLength(config: ZeroGapState, wizardStep: WizardStep): number {
    const dPan = config.assembly.insertionDistance || 10;
    const dHandle = config.handle.insertionDepth || 10;
    const headLength = Math.max(dPan, 10);
    const tailLength = Math.max(dHandle, 10);
    return (wizardStep === 'technical-review' || wizardStep === 'final-inspect')
      ? (config.tube.partLength + headLength + tailLength)
      : config.tube.totalLength;
  }

  /**
   * حساب النقطة الدقيقة على السطح الخارجي للأنبوب عند الزاوية phi
   * يدعم الأنبوب المستطيل ذو الزوايا الدائرية (مستطيل)، الدائري (دائري)، والبيضاوي (بيضاوي)
   */
  static getTubeSurfacePoint(
    phi: number,
    tw: number,
    th: number,
    shape: string,
    cornerRadius: number
  ): { x: number; y: number } {
    if (shape === 'دائري') {
      const r = tw / 2;
      return { x: r * Math.cos(phi), y: r * Math.sin(phi) };
    }

    if (shape === 'بيضاوي') {
      return { x: (tw / 2) * Math.cos(phi), y: (th / 2) * Math.sin(phi) };
    }

    // مستطيل مع نصف قطر زاوية (Rounded Rectangle) مطابق لـ TubeGenerator.ts
    const hx = tw / 2;
    const hy = th / 2;
    const r = Math.max(0, Math.min(cornerRadius || 0, hx, hy));
    const dx = Math.cos(phi);
    const dy = Math.sin(phi);
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    const cx = hx - r;
    const cy = hy - r;

    let t = hx;
    if (adx > 1e-9 && (hx / adx) * ady <= cy) {
      // تقاطع مع الجدار العمودي المستقيم
      t = hx / adx;
    } else if (ady > 1e-9 && (hy / ady) * adx <= cx) {
      // تقاطع مع الجدار الأفقي المستقيم
      t = hy / ady;
    } else if (r > 1e-6) {
      // تقاطع مع قوس الزاوية الدائرية: (t*|dx| - cx)^2 + (t*|dy| - cy)^2 = r^2
      const b = adx * cx + ady * cy;
      const c = cx * cx + cy * cy - r * r;
      const disc = Math.max(0, b * b - c);
      t = b + Math.sqrt(disc);
    } else {
      const tx = adx > 1e-9 ? hx / adx : Infinity;
      const ty = ady > 1e-9 ? hy / ady : Infinity;
      t = Math.min(tx, ty);
    }

    return { x: t * dx, y: t * dy };
  }

  /**
   * بناء منحنى المقطع الجانبي للمقلاة مطابقاً تماماً لـ PanGenerator.ts
   */
  static buildPanWallProfile(panConfig: PanConfig, rOff: number): {
    wallPts: THREE.Vector2[];
    pBoundZ: number;
    yMin: number;
    yMax: number;
  } {
    const wt = panConfig.wallThickness || 2.0;
    const rBottom = panConfig.innerMoldMode
      ? panConfig.bottomDiameter / 2 + wt
      : panConfig.bottomDiameter / 2;
    const rTop = panConfig.innerMoldMode
      ? panConfig.topDiameter / 2 + wt
      : panConfig.topDiameter / 2;
    const panH = panConfig.height;
    const rimThick = panConfig.rimThickness || 2.0;
    const curveRad = panConfig.curveRadius ?? 100.0;
    const filletR = panConfig.bottomFilletRadius || 8.0;
    const addRim = panConfig.addRim;
    const rimH = panConfig.rimHeight || 3.0;

    const buildPts = (offset: number): THREE.Vector2[] => {
      const rb = Math.max(1, rBottom - offset);
      const rt = Math.max(1, rTop - offset);
      const fR = Math.max(0, filletR - offset);
      const baseY = offset > 0 ? wt : 0;
      const p: THREE.Vector2[] = [];

      if (panConfig.removeBottom) {
        p.push(new THREE.Vector2(rb, baseY));
      } else {
        if (fR > 0) {
          const segs = 16;
          for (let i = 0; i <= segs; i++) {
            const theta = (Math.PI / 2) * (1 - i / segs);
            p.push(new THREE.Vector2(rb - fR + fR * Math.cos(theta), baseY + fR - fR * Math.sin(theta)));
          }
        } else {
          p.push(new THREE.Vector2(rb, baseY));
        }
      }

      if (panConfig.wallProfile === 'straight') {
        p.push(new THREE.Vector2(rt, panH));
      } else {
        const startZ = baseY + (panConfig.removeBottom ? 0 : fR);
        const bulgeReduction = offset >= wt ? offset * 0.3 : 0;
        const bulge = Math.max(1.0, Math.min(20.0, (200.0 / curveRad) * 4.0) - bulgeReduction);
        const rM = (rb + rt) / 2.0 + bulge;
        const zM = (startZ + panH) / 2.0;
        const cpx = 2 * rM - 0.5 * rb - 0.5 * rt;
        const cpy = 2 * zM - 0.5 * startZ - 0.5 * panH;
        const c = new THREE.QuadraticBezierCurve(
          new THREE.Vector2(rb, startZ),
          new THREE.Vector2(cpx, cpy),
          new THREE.Vector2(rt, panH)
        );
        p.push(...c.getPoints(32).slice(1));
      }

      if (addRim && offset === 0) {
        p.push(new THREE.Vector2(rt + rimThick, panH));
        p.push(new THREE.Vector2(rt + rimThick, panH + rimH));
      } else {
        p.push(new THREE.Vector2(rt + (offset === 0 ? rimThick : 0), panH));
      }

      return p;
    };

    const outerWallPts = buildPts(0);
    let pBoundZ = 0;
    for (const pt of outerWallPts) {
      if (pt.x > pBoundZ) pBoundZ = pt.x;
    }

    const activeWallPts = rOff > 0 ? buildPts(rOff) : outerWallPts;
    const yMin = rOff > 0 ? wt : 0;
    const yMax = panH + (addRim && rOff === 0 ? rimH : 0);

    return { wallPts: activeWallPts, pBoundZ, yMin, yMax };
  }

  /**
   * استيفاء نصف قطر المقلاة الدقيق عند الارتفاع y
   */
  private static getPanRadiusAtY(y: number, wallPts: THREE.Vector2[]): number {
    if (wallPts.length === 0) return 0;
    if (y <= wallPts[0].y) return wallPts[0].x;
    const last = wallPts[wallPts.length - 1];
    if (y >= last.y) return last.x;

    for (let i = 0; i < wallPts.length - 1; i++) {
      const p0 = wallPts[i];
      const p1 = wallPts[i + 1];
      if (y >= p0.y && y <= p1.y) {
        const dy = p1.y - p0.y;
        if (Math.abs(dy) < 1e-6) return Math.max(p0.x, p1.x);
        const t = (y - p0.y) / dy;
        return p0.x + t * (p1.x - p0.x);
      }
    }
    return last.x;
  }

  /**
   * حساب نقاط التقاطع ثلاثية الأبعاد وثنائية الأبعاد (X, A) بدقة متناهية
   */
  private static computeCutProfiles(
    config: ZeroGapState,
    wizardStep: WizardStep,
    numPoints: number = 360
  ): {
    panPoints: { x: number; a: number; zRaw: number; phi: number }[];
    handlePoints: { x: number; a: number; zRaw: number; phi: number }[];
    tl: number;
    tw: number;
    th: number;
  } {
    const tw = config.tube.width;
    const th = config.tube.shape === 'دائري' ? tw : (config.tube.height || tw);
    const tl = this.getEffectiveTubeLength(config, wizardStep);
    const wt = config.pan.wallThickness || 2.0;
    const clearance = (wizardStep === 'final-inspect' && config.thermalClearance) ? 0.1 : 0;

    const rOff = (config.pan.applyThicknessToCut && config.pan.useShellPreview) ? wt : 0;
    const { wallPts, pBoundZ, yMin, yMax } = this.buildPanWallProfile(config.pan, rOff);

    const tiltAngle = config.assembly.tiltAngle || 0;
    const angleRad = tiltAngle * (Math.PI / 180);
    const tubeRoll = (config.assembly.handleAngleY || 0) * (Math.PI / 180);
    const heightOffset = config.assembly.heightOffset || 0;
    const insertion = config.assembly.insertionDistance || 0;
    const hInsertion = config.handle.insertionDepth ?? 15;

    const isStep5 =
      wizardStep === 'tube-handle-cut' ||
      wizardStep === 'technical-review' ||
      wizardStep === 'final-inspect';
    const tubeZPos = isStep5 ? (-tl + hInsertion / 2) : -(insertion / 2);
    const panZOffset = isStep5 ? (tubeZPos + insertion) : (insertion / 2);
    const panY = -(heightOffset || 0);

    // Three.js Euler(angleRad, 0, tubeRoll, 'XYZ') = R_x(angleRad) * R_z(tubeRoll)
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const cosR = Math.cos(tubeRoll);
    const sinR = Math.sin(tubeRoll);

    // 1. دالة المسافة الموقعة عن مجسم المقلاة (الوجه A عند z = 0)
    const evaluatePanDistance = (z: number, phi: number): number => {
      const surf = this.getTubeSurfacePoint(phi, tw, th, config.tube.shape, config.tube.cornerRadius);
      const x_t = surf.x;
      const y_t = surf.y;

      // الدوران حول محور Z أولاً (tubeRoll) ثم حول محور X (angleRad) وفق ترتيب Euler 'XYZ'
      const x_r = x_t * cosR - y_t * sinR;
      const y_r = x_t * sinR + y_t * cosR;
      const z_r = z;

      const x_world = x_r;
      const y_world = y_r * cosA - z_r * sinA;
      const z_world = y_r * sinA + z_r * cosA + tubeZPos;

      const x_pan = x_world;
      const y_pan = y_world - panY;
      const z_pan = z_world - (-pBoundZ + panZOffset);

      const r_pt = Math.hypot(x_pan, z_pan);
      const clampedY = Math.max(yMin, Math.min(yMax, y_pan));
      const r_wall = this.getPanRadiusAtY(clampedY, wallPts) + clearance;

      const d_radial = r_pt - r_wall;
      const d_vertical = Math.max(yMin - clearance - y_pan, y_pan - (yMax + clearance));
      return Math.max(d_radial, d_vertical);
    };

    // 2. دالة المسافة الموقعة عن مجسم المقبض الصلب (الوجه B عند z = tl)
    const evaluateHandleDistance = (z: number, phi: number): number => {
      const surf = this.getTubeSurfacePoint(phi, tw, th, config.tube.shape, config.tube.cornerRadius);
      const x_t = surf.x;
      const y_t = surf.y;
      const z_t = z - tl / 2;

      const hCfg = config.handle;
      const hOffsetZ = hCfg.offsetZ || 0;

      const dx = x_t - hOffsetZ;
      const dy = y_t;
      const dz = z_t - (tl / 2 - hInsertion);

      // معكوس مصفوفة الدوران لـ Euler(alpha, beta, 0, 'XYZ') هو R_y(-beta) * R_x(-alpha)
      const alpha = (hCfg.angleX || 0) * (Math.PI / 180);
      const beta = (hCfg.angleY || 0) * (Math.PI / 180);

      // R_x(-alpha) أولاً
      const x1 = dx;
      const y1 = dy * Math.cos(-alpha) - dz * Math.sin(-alpha);
      const z1 = dy * Math.sin(-alpha) + dz * Math.cos(-alpha);

      // R_y(-beta) ثانياً
      const x2 = x1 * Math.cos(-beta) + z1 * Math.sin(-beta);
      const y2 = y1;
      const z2 = -x1 * Math.sin(-beta) + z1 * Math.cos(-beta);

      const depth = hCfg.depth || 80;
      const hBoundZ = depth / 2;
      const x_handle = x2;
      const y_handle = y2;
      const z_handle = z2 - hBoundZ;

      if (hCfg.shape === 'cylindrical') {
        const outerR = hCfg.width / 2 + clearance;
        const d_rad = Math.hypot(x_handle, y_handle) - outerR;
        const d_z = Math.abs(z_handle) - (depth / 2 + clearance);
        return Math.max(d_rad, d_z);
      } else {
        const hw = (hCfg.width || 30) + 2 * clearance;
        const hh = (hCfg.height || 20) + 2 * clearance;
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

        const d_z = Math.abs(z_handle) - (depth / 2 + clearance);
        return Math.max(d2d, d_z);
      }
    };

    // حل تقاطع الوجه A (المقلاة): نبحث عن نقطة الخروج من المقلاة إلى بدن الأنبوب
    const panPoints: { x: number; a: number; zRaw: number; phi: number }[] = [];
    const maxPanSearch = Math.min(tl, Math.max(insertion * 2.2, 80));
    const scanSteps = 80;

    for (let i = 0; i <= numPoints; i++) {
      const phi = (i / numPoints) * 2 * Math.PI;
      let z_sol = 0;

      // البحث من داخل الأنبوب باتجاه الطرف A لإيجاد آخر انتقال من داخل المقلاة (<=0) إلى خارجها (>0)
      let prevZ = 0;
      let prevF = evaluatePanDistance(0, phi);
      let bracketFound = false;
      let low = 0;
      let high = 0;
      let f_low = prevF;

      for (let s = 1; s <= scanSteps; s++) {
        const currZ = (s / scanSteps) * maxPanSearch;
        const currF = evaluatePanDistance(currZ, phi);
        if (prevF <= 0 && currF >= 0) {
          low = prevZ;
          high = currZ;
          f_low = prevF;
          bracketFound = true;
        }
        prevZ = currZ;
        prevF = currF;
      }

      if (bracketFound) {
        for (let iter = 0; iter < 24; iter++) {
          const mid = (low + high) / 2;
          const f_mid = evaluatePanDistance(mid, phi);
          if (Math.abs(f_mid) < 1e-6) {
            low = mid;
            high = mid;
            break;
          }
          if (f_mid * f_low > 0) {
            low = mid;
            f_low = f_mid;
          } else {
            high = mid;
          }
        }
        z_sol = (low + high) / 2;
      } else {
        // إذا لم تصل المقلاة لحافة الأنبوب عند هذه الزاوية، فإن الحد الفعلي للقطعة ثلاثية الأبعاد يقع عند الوجه الأمامي z = 0
        z_sol = 0;
      }

      let a_deg = phi * (180 / Math.PI);
      if (a_deg < 0) a_deg += 360;
      const zRaw = Math.max(0, Math.min(tl, z_sol));
      panPoints.push({ x: zRaw, a: a_deg, zRaw, phi });
    }

    // حل تقاطع الوجه B (المقبض): نبحث عن أول دخول للأنبوب داخل المقبض بالقرب من الطرف B
    const handlePoints: { x: number; a: number; zRaw: number; phi: number }[] = [];
    const minHandleSearch = Math.max(0, tl - Math.max(hInsertion * 2.5, 60));

    for (let i = 0; i <= numPoints; i++) {
      const phi = (i / numPoints) * 2 * Math.PI;
      let z_sol = tl;

      let prevZ = minHandleSearch;
      let prevF = evaluateHandleDistance(prevZ, phi);
      let bracketFound = false;
      let low = minHandleSearch;
      let high = tl;
      let f_low = prevF;

      for (let s = 1; s <= scanSteps; s++) {
        const currZ = minHandleSearch + (s / scanSteps) * (tl - minHandleSearch);
        const currF = evaluateHandleDistance(currZ, phi);
        if (prevF >= 0 && currF <= 0) {
          low = prevZ;
          high = currZ;
          f_low = prevF;
          bracketFound = true;
          break;
        }
        prevZ = currZ;
        prevF = currF;
      }

      if (bracketFound) {
        for (let iter = 0; iter < 24; iter++) {
          const mid = (low + high) / 2;
          const f_mid = evaluateHandleDistance(mid, phi);
          if (Math.abs(f_mid) < 1e-6) {
            low = mid;
            high = mid;
            break;
          }
          if (f_mid * f_low > 0) {
            low = mid;
            f_low = f_mid;
          } else {
            high = mid;
          }
        }
        z_sol = (low + high) / 2;
      } else {
        // إذا لم يتقاطع المقبض مع الجدار الخارجي عند هذه الزاوية، فإن الحد الفعلي للقطعة يقع عند النهاية z = tl
        z_sol = tl;
      }

      let a_deg = phi * (180 / Math.PI);
      if (a_deg < 0) a_deg += 360;
      const zRaw = Math.max(0, Math.min(tl, z_sol));
      handlePoints.push({ x: zRaw, a: a_deg, zRaw, phi });
    }

    return { panPoints, handlePoints, tl, tw, th };
  }

  static generatePoints(
    config: ZeroGapState,
    wizardStep: WizardStep
  ): { panPoints3D: THREE.Vector3[]; handlePoints3D: THREE.Vector3[] } {
    const { panPoints, handlePoints, tl, tw, th } = this.computeCutProfiles(config, wizardStep, 360);

    const to3D = (pt: { phi: number; zRaw: number }) => {
      const surf = this.getTubeSurfacePoint(
        pt.phi,
        tw,
        th,
        config.tube.shape,
        config.tube.cornerRadius
      );
      const pz = pt.zRaw - tl / 2;
      return new THREE.Vector3(surf.x, surf.y, pz);
    };

    return {
      panPoints3D: panPoints.map(to3D),
      handlePoints3D: handlePoints.map(to3D),
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

    const { panPoints, handlePoints, tl, tw, th } = this.computeCutProfiles(config, wizardStep, 180);

    const pPointsSorted = [...panPoints].sort((p1, p2) => p1.a - p2.a);
    const hPointsSorted = [...handlePoints].sort((p1, p2) => p1.a - p2.a);

    const pPointsUnique: { x: number; a: number }[] = [];
    for (const pt of pPointsSorted) {
      if (pPointsUnique.length === 0 || Math.abs(pt.a - pPointsUnique[pPointsUnique.length - 1].a) > 0.01) {
        pPointsUnique.push({ x: pt.x, a: pt.a });
      }
    }

    const hPointsUnique: { x: number; a: number }[] = [];
    for (const pt of hPointsSorted) {
      if (hPointsUnique.length === 0 || Math.abs(pt.a - hPointsUnique[hPointsUnique.length - 1].a) > 0.01) {
        hPointsUnique.push({ x: pt.x, a: pt.a });
      }
    }

    if (pPointsUnique.length < 12) {
      return {
        gcode: '',
        validation: { isValid: false, errors: ['خطأ في معالجة نقاط التقاطع للأنبوب والمقلاة.'], warnings: [] },
        estimatedTime: 0,
        error: 'خطأ في معالجة نقاط التقاطع للأنبوب والمقلاة. يرجى مراجعة قيم التصميم وزوايا الاتصال.',
      };
    }

    const lines: string[] = [];
    lines.push('%');
    lines.push('O2000 (MECAFLOW-CAD V2.3 ZERO-GAP INDUSTRIAL G-CODE)');
    lines.push('(Generated directly by MecaFlow Machine Interface)');
    lines.push(`(Date: ${new Date().toISOString().split('T')[0]} - Time: ${new Date().toLocaleTimeString('ar-EG')})`);
    lines.push('(Laser Power: 1500W, Auxiliary Gas: O2)');
    lines.push(`(TUBE OUTER BOUNDS: ${tw}mm x ${th}mm, LENGTH: ${tl.toFixed(2)}mm)`);
    lines.push(`(PAN BOTTOM: ${config.pan.bottomDiameter}mm, TOP: ${config.pan.topDiameter}mm)`);
    lines.push(`(HANDLE WIDTH: ${config.handle.width}mm, DEPTH: ${config.handle.depth}mm)`);
    lines.push('');

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
      const dist = Math.hypot(pt.x - currentPos.x, (pt.a - currentPos.z) * (Math.PI / 180) * (tw / 2));
      estimatedTime += (dist / feed) * 60;
      currentPos.set(pt.x, 0, pt.a);
    }
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
        estimatedTime += (dist / feed) * 60;
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
      estimatedTime: estimatedTime / 60,
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
