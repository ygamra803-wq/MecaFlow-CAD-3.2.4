import * as THREE from 'three';
import { ZeroGapState, WizardStep } from '../../types';
import { GCodeGenerator } from '../gcodeGenerator';

export interface GapSamplePoint {
  angleRad: number;
  angleDeg: number;
  tubePoint3D: THREE.Vector3;
  targetPoint3D: THREE.Vector3;
  gapMm: number;
  interferenceMm: number;
  isContact: boolean;
  reason?: 'vertical-miss' | 'radial-miss' | 'insufficient-insertion' | 'radial-clearance' | 'contact';
}

export interface GapSector {
  startAngleDeg: number;
  endAngleDeg: number;
  maxGapMm: number;
  avgGapMm: number;
  centerPoint3D: THREE.Vector3;
  description: string;
}

export interface JointCollisionReport {
  joint: 'pan' | 'handle';
  labelAr: string;
  contactCoveragePercent: number;
  maxGapMm: number;
  avgGapMm: number;
  maxInterferenceMm: number;
  estimatedInterferenceVolumeMm3: number;
  status: 'zero-gap' | 'gap-detected' | 'critical-breach';
  samples: GapSamplePoint[];
  gapSectors: GapSector[];
}

export interface CollisionIssue {
  id: string;
  joint: 'pan' | 'handle' | 'assembly';
  type: 'gap' | 'collision' | 'over-penetration';
  severity: 'critical' | 'warning' | 'ok';
  title: string;
  message: string;
  gapMm?: number;
}

export interface CollisionAnalysisReport {
  hasGaps: boolean;
  hasCriticalIssues: boolean;
  manufacturingReadinessScore: number;
  panJoint: JointCollisionReport;
  handleJoint: JointCollisionReport;
  axialBridgeLengthMm: number;
  panHandleOverlapMm: number;
  issues: CollisionIssue[];
  timestamp: number;
}

/**
 * محرك التحليل الهندسي للتداخل والفجوات (Zero-Gap Collision & Fitment Analyzer)
 * يفحص محيط الأنبوب بـ 72 قطاعاً زاوياً (كل 5 درجات) عند وصلة المقلاة (الطرف B) ووصلة المقبض (الطرف A)
 * ويكتشف أي فجوات عدم تلامس (Gaps) أو تداخلات حرجة (Over-Penetration / Collisions) لتظليلها باللون الأحمر ثلاثي الأبعاد.
 */
export class CollisionAnalyzer {
  private static readonly ANGULAR_SAMPLES = 72;
  private static readonly GAP_TOLERANCE_MM = 0.08;

  /**
   * حساب نصف قطر المقلاة الخارجي أو الفعلي عند ارتفاع محلي y_pan
   */
  public static getPanRadiusAtY(pan: ZeroGapState['pan'], yPan: number): {
    radius: number;
    clampedY: number;
    verticalMissMm: number;
  } {
    const halfH = Math.max(pan.height, 10) / 2;
    const rBottom = Math.max(pan.bottomDiameter, 20) / 2;
    const rTop = Math.max(pan.topDiameter, rBottom) / 2;
    const wallOffset = pan.applyThicknessToCut ? -(pan.wallThickness || 0) : 0;

    let verticalMissMm = 0;
    let clampedY = yPan;
    if (yPan < -halfH) {
      verticalMissMm = -halfH - yPan;
      clampedY = -halfH;
    } else if (yPan > halfH) {
      verticalMissMm = yPan - halfH;
      clampedY = halfH;
    }

    // نسبة الارتفاع من القاع (0) إلى القمة (1)
    const t = Math.max(0, Math.min(1, (clampedY + halfH) / Math.max(pan.height, 1)));

    let r = rBottom + (rTop - rBottom) * t;
    if (pan.wallProfile === 'curved' && pan.curveRadius > 10) {
      // تقوس الجدار الجانبي نحو الخارج وفق نصف قطر الانحناء
      const sagitta = Math.min(12, (pan.height * pan.height) / (8 * Math.max(pan.curveRadius, 25)));
      r += sagitta * Math.sin(t * Math.PI);
    }

    return {
      radius: Math.max(10, r + wallOffset),
      clampedY,
      verticalMissMm,
    };
  }

  /**
   * حساب نقطة السطح الخارجي للمقبض عند زاوية معينة
   */
  public static getHandleSurfacePoint(
    theta: number,
    handle: ZeroGapState['handle']
  ): THREE.Vector2 {
    const hw = Math.max(handle.width || 30, 4);
    const hh = handle.shape === 'cylindrical' ? hw : Math.max(handle.height || 20, 4);
    const shapeType = handle.shape === 'cylindrical' ? 'دائري' : 'مستطيل';
    const cr = handle.shape === 'cylindrical' ? hw / 2 : Math.min(handle.cornerRadius || 2, hw / 2, hh / 2);
    return GCodeGenerator.getTubeSurfacePoint(theta, hw, hh, shapeType, cr);
  }

  /**
   * تحليل شامل للتداخل والفجوات في التصميم الحالي
   */
  public static analyze(
    config: ZeroGapState,
    wizardStep: WizardStep = 'final-inspect'
  ): CollisionAnalysisReport {
    const tl = GCodeGenerator.getEffectiveTubeLength(config, wizardStep);
    const tw = Math.max(config.tube.width || 38, 6);
    const th = config.tube.shape === 'دائري' ? tw : Math.max(config.tube.height || 25, 6);
    const wallThick = Math.max(config.tube.thickness || 1.2, 0.4);
    const innerW = Math.max(2, tw - wallThick * 2);
    const innerH = Math.max(2, th - wallThick * 2);
    const innerCr = Math.max(0.5, (config.tube.cornerRadius || 3) - wallThick);

    const panSamples: GapSamplePoint[] = [];
    const handleSamples: GapSamplePoint[] = [];

    // معاملات تحويل وصلة المقلاة (الطرف B - الأمامي عند z = -tl/2)
    const tiltRad = ((config.assembly.tiltAngle || 0) * Math.PI) / 180;
    const rollRad = ((config.assembly.handleAngleY || 0) * Math.PI) / 180;
    const cosTilt = Math.cos(tiltRad);
    const sinTilt = Math.sin(tiltRad);
    const insertionDist = Math.max(0, config.assembly.insertionDistance || 0);
    const heightOffset = config.assembly.heightOffset || 0;
    const panRefRadius = Math.max(config.pan.topDiameter, config.pan.bottomDiameter) / 2;

    // معاملات تحويل وصلة المقبض (الطرف A - الخلفي عند z = +tl/2)
    const hInsertion = Math.max(0, config.handle.insertionDepth ?? 15);
    const hAngleXRad = ((config.handle.angleX || 0) * Math.PI) / 180;
    const hAngleYRad = ((config.handle.angleY || 0) * Math.PI) / 180;
    const hOffsetX = config.handle.offsetZ || 0;

    // حساب نقاط مسار القطع الفعلي من GCodeGenerator للمقارنة الدقيقة
    const { panPoints3D, handlePoints3D } = GCodeGenerator.generatePoints(config, wizardStep);

    let maxPanCutZ = -tl / 2;
    let minHandleCutZ = tl / 2;

    for (let i = 0; i < this.ANGULAR_SAMPLES; i++) {
      const theta = (i / this.ANGULAR_SAMPLES) * Math.PI * 2;
      const angleDeg = (theta * 180) / Math.PI;

      // ─────────────────────────────────────────────────────────────────────────
      // 1. فحص وصلة المقلاة (Joint B: Pan - Tube)
      // ─────────────────────────────────────────────────────────────────────────
      const outerPt2D = GCodeGenerator.getTubeSurfacePoint(
        theta,
        tw,
        th,
        config.tube.shape,
        config.tube.cornerRadius
      );

      // تطبيق دوران الأنبوب حول المحور Z (Roll)
      const xr = outerPt2D.x * Math.cos(rollRad) - outerPt2D.y * Math.sin(rollRad);
      const yr = outerPt2D.x * Math.sin(rollRad) + outerPt2D.y * Math.cos(rollRad);

      // ارتفاع الشعاع عند جدار المقلاة
      const yAtPan = heightOffset + yr * cosTilt;
      const panProfile = this.getPanRadiusAtY(config.pan, yAtPan);
      const panR = panProfile.radius;

      // فحص ما إذا كان الشعاع يقع ضمن عرض المقلاة الأفقية |xr| <= panR
      const radialMissMm = Math.max(0, Math.abs(xr) - panR);
      const verticalMissMm = panProfile.verticalMissMm;

      // عمق السرج المثالي المطلوب لملامسة جدار المقلاة المنحني عند هذه الزاوية
      const clampedX = Math.min(Math.abs(xr), panR * 0.999);
      const panSurfaceSag = panR - Math.sqrt(Math.max(0, panR * panR - clampedX * clampedX));
      const tiltSaddleDelta = yr * Math.sin(tiltRad) + (panProfile.radius - panRefRadius) * 0.25;
      const idealLocalZ = -tl / 2 + insertionDist - panSurfaceSag - tiltSaddleDelta;

      // النقطة الفعلية على حافة الأنبوب المقطوعة
      const panCutPt = panPoints3D[i]
        ? panPoints3D[i].clone()
        : new THREE.Vector3(outerPt2D.x, outerPt2D.y, Math.max(-tl / 2, Math.min(tl / 2, idealLocalZ)));

      if (panCutPt.z > maxPanCutZ) maxPanCutZ = panCutPt.z;

      // حساب الفجوة الفعلية عند الزاوية theta
      let panGapMm = 0;
      let panReason: GapSamplePoint['reason'] = 'contact';

      if (insertionDist <= 0.5) {
        panGapMm = Math.max(2.0, panSurfaceSag + Math.abs(tiltSaddleDelta) + 1.5);
        panReason = 'insufficient-insertion';
      } else if (verticalMissMm > 0.1 || radialMissMm > 0.1) {
        panGapMm = Math.hypot(verticalMissMm, radialMissMm);
        panReason = verticalMissMm >= radialMissMm ? 'vertical-miss' : 'radial-miss';
      } else if (idealLocalZ < -tl / 2 - 0.15) {
        // الأنبوب لا يصل إلى سطح المقلاة عند هذه الزاوية بسبب قلة عمق الاختراق مع زاوية الميلان
        panGapMm = -tl / 2 - idealLocalZ;
        panReason = 'insufficient-insertion';
      }

      const panTargetPt = panCutPt.clone();
      if (panGapMm > this.GAP_TOLERANCE_MM) {
        // إزاحة نقطة الهدف باتجاه المقلاة (-Z) والاتجاه الشعاعي لتمثيل الفجوة ثلاثية الأبعاد بدقة
        const radialDir = new THREE.Vector3(outerPt2D.x, outerPt2D.y, 0).normalize();
        panTargetPt.z -= Math.max(panGapMm, 2.5);
        if (verticalMissMm > 0.1) {
          panTargetPt.y += yAtPan > 0 ? -verticalMissMm * 0.45 : verticalMissMm * 0.45;
        }
        if (radialMissMm > 0.1) {
          panTargetPt.x -= Math.sign(outerPt2D.x) * radialMissMm * 0.45;
        } else {
          panTargetPt.addScaledVector(radialDir, 0.35);
        }
      }

      const panInterferenceMm = Math.max(0, panCutPt.z - (-tl / 2));

      panSamples.push({
        angleRad: theta,
        angleDeg,
        tubePoint3D: panCutPt,
        targetPoint3D: panTargetPt,
        gapMm: Number(panGapMm.toFixed(3)),
        interferenceMm: Number(panInterferenceMm.toFixed(3)),
        isContact: panGapMm <= this.GAP_TOLERANCE_MM,
        reason: panReason,
      });

      // ─────────────────────────────────────────────────────────────────────────
      // 2. فحص وصلة المقبض (Joint A: Tube - Handle)
      // ─────────────────────────────────────────────────────────────────────────
      const innerTubePt2D = GCodeGenerator.getTubeSurfacePoint(
        theta,
        innerW,
        innerH,
        config.tube.shape,
        innerCr
      );
      const handlePt2D = this.getHandleSurfacePoint(theta - hAngleYRad, config.handle);

      // تطبيق إزاحة وزاوية ميلان المقبض عند منطقة التداخل
      const shiftedHandleX = handlePt2D.x + hOffsetX;
      const shiftedHandleY = handlePt2D.y + hInsertion * 0.5 * Math.sin(hAngleXRad);

      const tubeInnerRadius = Math.hypot(innerTubePt2D.x, innerTubePt2D.y);
      const tubeOuterRadius = Math.hypot(outerPt2D.x, outerPt2D.y);
      const handleEffectiveRadius = Math.hypot(shiftedHandleX, shiftedHandleY);

      const handleCutPt = handlePoints3D[i]
        ? handlePoints3D[i].clone()
        : new THREE.Vector3(outerPt2D.x, outerPt2D.y, tl / 2 - hInsertion);

      if (handleCutPt.z < minHandleCutZ) minHandleCutZ = handleCutPt.z;

      let handleGapMm = 0;
      let handleInterferenceMm = 0;
      let handleReason: GapSamplePoint['reason'] = 'contact';

      if (hInsertion <= 0.5) {
        handleGapMm = Math.max(2.0, Math.abs(tubeInnerRadius - handleEffectiveRadius) + 2.0);
        handleReason = 'insufficient-insertion';
      } else if (handleEffectiveRadius < tubeInnerRadius - this.GAP_TOLERANCE_MM) {
        // فجوة خلوص شعاعية بين السطح الخارجي للمقبض والجدار الداخلي للأنبوب
        handleGapMm = tubeInnerRadius - handleEffectiveRadius;
        handleReason = 'radial-clearance';
      } else {
        // المقبض يتقاطع مع جدار الأنبوب
        handleInterferenceMm = Math.min(
          wallThick + Math.max(0, handleEffectiveRadius - tubeOuterRadius),
          Math.max(0.2, handleEffectiveRadius - tubeInnerRadius)
        );
      }

      // نقطة الهدف على سطح المقبض الفعلي لإظهار شريط الفجوة الحمراء بين جدار الأنبوب والمقبض
      const handleTargetPt = new THREE.Vector3(
        shiftedHandleX,
        shiftedHandleY,
        hInsertion <= 0.5 ? handleCutPt.z + 3.5 : handleCutPt.z
      );

      handleSamples.push({
        angleRad: theta,
        angleDeg,
        tubePoint3D: new THREE.Vector3(innerTubePt2D.x, innerTubePt2D.y, handleCutPt.z),
        targetPoint3D: handleTargetPt,
        gapMm: Number(handleGapMm.toFixed(3)),
        interferenceMm: Number(handleInterferenceMm.toFixed(3)),
        isContact: handleGapMm <= this.GAP_TOLERANCE_MM,
        reason: handleReason,
      });
    }

    const panJoint = this.buildJointReport('pan', 'وصلة المقلاة الأمامية (الطرف B)', panSamples, tw, th, wallThick);
    const handleJoint = this.buildJointReport('handle', 'وصلة المقبض الخلفية (الطرف A)', handleSamples, tw, th, wallThick);

    const axialBridgeLengthMm = Number((minHandleCutZ - maxPanCutZ).toFixed(2));
    const panHandleOverlapMm = Number(Math.max(0, maxPanCutZ - minHandleCutZ).toFixed(2));

    const issues: CollisionIssue[] = [];

    // 1. فحص التداخل المحوري بين قص المقلاة وقص المقبض
    if (panHandleOverlapMm > 0) {
      issues.push({
        id: 'axial-collision',
        joint: 'assembly',
        type: 'collision',
        severity: 'critical',
        title: 'تصادم محوري بين قص المقلاة وقص المقبض',
        message: `منطقة قطع المقلاة تتداخل مع منطقة قطع المقبض بمقدار ${panHandleOverlapMm.toFixed(1)} مم، مما يؤدي إلى انقسام الأنبوب بالكامل.`,
        gapMm: panHandleOverlapMm,
      });
    } else if (axialBridgeLengthMm < 10) {
      issues.push({
        id: 'narrow-bridge',
        joint: 'assembly',
        type: 'over-penetration',
        severity: 'warning',
        title: 'ضيق البدن السليم بين الوصلتين',
        message: `المسافة الصافية المتبقية بين القص الأمامي والخلفي هي ${axialBridgeLengthMm.toFixed(1)} مم فقط (يُنصح بـ 15 مم على الأقل لمتانة اللحام).`,
      });
    }

    // 2. فحص فجوات المقلاة (الطرف B)
    if (panJoint.maxGapMm > this.GAP_TOLERANCE_MM) {
      const hasVerticalMiss = panSamples.some((s) => s.reason === 'vertical-miss');
      const hasRadialMiss = panSamples.some((s) => s.reason === 'radial-miss');
      let reasonDesc = 'عمق الاختراق غير كافٍ لتغطية زاوية ميلان الأنبوب بالكامل';
      if (hasVerticalMiss) {
        reasonDesc = 'ارتفاع الأنبوب (Height Offset) يخرج جزئياً عن ارتفاع جدار المقلاة';
      } else if (hasRadialMiss) {
        reasonDesc = 'عرض الأنبوب يتجاوز نصف قطر المقلاة عند منطقة التماس';
      }

      issues.push({
        id: 'pan-gap',
        joint: 'pan',
        type: 'gap',
        severity: panJoint.maxGapMm > 1.0 ? 'critical' : 'warning',
        title: `فجوة غير صفرية في وصلة المقلاة (${panJoint.maxGapMm.toFixed(2)} مم)`,
        message: `${reasonDesc}. نسبة التلامس المحيطي الحالية ${panJoint.contactCoveragePercent.toFixed(0)}%.`,
        gapMm: panJoint.maxGapMm,
      });
    }

    // فحص اختراق الجدار الداخلي للمقلاة
    const maxSafePanInsertion = Math.max(15, config.pan.topDiameter * 0.28);
    if (insertionDist > maxSafePanInsertion) {
      issues.push({
        id: 'pan-over-penetration',
        joint: 'pan',
        type: 'over-penetration',
        severity: 'warning',
        title: 'اختراق عميق لتجويف المقلاة الداخلي',
        message: `عمق اختراق الأنبوب (${insertionDist} مم) يتجاوز الحد المثالي لجدار المقلاة (${maxSafePanInsertion.toFixed(0)} مم) ويستهلك معدناً إضافياً.`,
      });
    }

    // 3. فحص فجوات المقبض (الطرف A)
    if (handleJoint.maxGapMm > this.GAP_TOLERANCE_MM) {
      issues.push({
        id: 'handle-gap',
        joint: 'handle',
        type: 'gap',
        severity: handleJoint.maxGapMm > 1.5 ? 'critical' : 'warning',
        title: `فجوة خلوص بين الأنبوب والمقبض (${handleJoint.maxGapMm.toFixed(2)} مم)`,
        message: `أبعاد المقبض (${config.handle.width}×${config.handle.shape === 'cylindrical' ? config.handle.width : config.handle.height} مم) أصغر من التجويف الداخلي للأنبوب (${innerW.toFixed(1)}×${innerH.toFixed(1)} مم)، مما يترك فجوة هوائية تعيق اللحام الصفري المباشر.`,
        gapMm: handleJoint.maxGapMm,
      });
    }

    const hasGaps =
      panJoint.maxGapMm > this.GAP_TOLERANCE_MM ||
      handleJoint.maxGapMm > this.GAP_TOLERANCE_MM ||
      panHandleOverlapMm > 0;
    const hasCriticalIssues = issues.some((iss) => iss.severity === 'critical');

    // حساب مؤشر جاهزية التصنيع الصفري (0 - 100%)
    let score = (panJoint.contactCoveragePercent * 0.55) + (handleJoint.contactCoveragePercent * 0.45);
    if (panHandleOverlapMm > 0) score = Math.min(score, 20);
    score -= Math.min(35, (panJoint.maxGapMm + handleJoint.maxGapMm) * 4);
    const manufacturingReadinessScore = Math.max(0, Math.min(100, Math.round(score)));

    return {
      hasGaps,
      hasCriticalIssues,
      manufacturingReadinessScore,
      panJoint,
      handleJoint,
      axialBridgeLengthMm,
      panHandleOverlapMm,
      issues,
      timestamp: Date.now(),
    };
  }

  /**
   * تجميع عينات الزوايا في قطاعات فجوات متصلة وتقدير حجم التداخل المعدني
   */
  private static buildJointReport(
    joint: 'pan' | 'handle',
    labelAr: string,
    samples: GapSamplePoint[],
    tw: number,
    th: number,
    wallThick: number
  ): JointCollisionReport {
    const contactCount = samples.filter((s) => s.isContact).length;
    const contactCoveragePercent = (contactCount / Math.max(1, samples.length)) * 100;

    let maxGapMm = 0;
    let gapSum = 0;
    let gapSampleCount = 0;
    let maxInterferenceMm = 0;
    let interferenceSum = 0;

    for (const s of samples) {
      if (s.gapMm > maxGapMm) maxGapMm = s.gapMm;
      if (s.gapMm > this.GAP_TOLERANCE_MM) {
        gapSum += s.gapMm;
        gapSampleCount++;
      }
      if (s.interferenceMm > maxInterferenceMm) maxInterferenceMm = s.interferenceMm;
      interferenceSum += s.interferenceMm;
    }

    const avgGapMm = gapSampleCount > 0 ? gapSum / gapSampleCount : 0;
    const avgInterference = interferenceSum / Math.max(1, samples.length);
    const perimeterApprox = 2 * (tw + th);
    const estimatedInterferenceVolumeMm3 = Number(
      (perimeterApprox * wallThick * Math.max(0.5, avgInterference)).toFixed(1)
    );

    // استخراج قطاعات الفجوات المتصلة (Gap Sectors)
    const gapSectors: GapSector[] = [];
    let currentSector: GapSamplePoint[] = [];

    const flushSector = (sectorSamples: GapSamplePoint[]) => {
      if (sectorSamples.length === 0) return;
      const startAngleDeg = sectorSamples[0].angleDeg;
      const endAngleDeg = sectorSamples[sectorSamples.length - 1].angleDeg;
      const sectorMaxGap = Math.max(...sectorSamples.map((s) => s.gapMm));
      const sectorAvgGap =
        sectorSamples.reduce((acc, s) => acc + s.gapMm, 0) / sectorSamples.length;
      const midSample = sectorSamples[Math.floor(sectorSamples.length / 2)];
      const centerPoint3D = midSample.tubePoint3D
        .clone()
        .lerp(midSample.targetPoint3D, 0.5);

      gapSectors.push({
        startAngleDeg: Math.round(startAngleDeg),
        endAngleDeg: Math.round(endAngleDeg),
        maxGapMm: Number(sectorMaxGap.toFixed(2)),
        avgGapMm: Number(sectorAvgGap.toFixed(2)),
        centerPoint3D,
        description: `قطاع زاوي (${Math.round(startAngleDeg)}° - ${Math.round(endAngleDeg)}°) بفجوة قصوى ${sectorMaxGap.toFixed(2)} مم`,
      });
    };

    for (const s of samples) {
      if (!s.isContact) {
        currentSector.push(s);
      } else if (currentSector.length > 0) {
        flushSector(currentSector);
        currentSector = [];
      }
    }
    if (currentSector.length > 0) {
      flushSector(currentSector);
    }

    let status: JointCollisionReport['status'] = 'zero-gap';
    if (maxGapMm > 1.5 || contactCoveragePercent < 50) {
      status = 'critical-breach';
    } else if (maxGapMm > this.GAP_TOLERANCE_MM) {
      status = 'gap-detected';
    }

    return {
      joint,
      labelAr,
      contactCoveragePercent: Number(contactCoveragePercent.toFixed(1)),
      maxGapMm: Number(maxGapMm.toFixed(2)),
      avgGapMm: Number(avgGapMm.toFixed(2)),
      maxInterferenceMm: Number(maxInterferenceMm.toFixed(2)),
      estimatedInterferenceVolumeMm3,
      status,
      samples,
      gapSectors,
    };
  }

  /**
   * الضبط الهندسي التلقائي (Auto-Fix Zero-Gap) لإزالة كافة الفجوات المكتشفة بضغطة واحدة
   */
  public static computeAutoFix(config: ZeroGapState): ZeroGapState {
    const tw = Math.max(config.tube.width || 38, 6);
    const th = config.tube.shape === 'دائري' ? tw : Math.max(config.tube.height || 25, 6);
    const tiltRad = Math.abs(((config.assembly.tiltAngle || 0) * Math.PI) / 180);

    // 1. ضبط ارتفاع الأنبوب ليقع بالكامل ضمن جدار المقلاة السليم
    const maxAllowedOffset = Math.max(0, config.pan.height / 2 - (th / 2) * Math.cos(tiltRad) - 4);
    const clampedHeightOffset = Math.max(
      -maxAllowedOffset,
      Math.min(maxAllowedOffset, config.assembly.heightOffset || 0)
    );

    // 2. ضبط عمق اختراق المقلاة ليغطي فرق زاوية الميلان وتقوس المقلاة دون فجوة
    const minRequiredInsertion = Math.ceil((th / 2) * Math.sin(tiltRad) + 18);
    const optimalInsertionDistance = Math.max(
      minRequiredInsertion,
      Math.min(config.assembly.insertionDistance || 35, Math.floor(config.tube.totalLength * 0.42))
    );

    // 3. مطابقة أبعاد المقبض مع جدار الأنبوب لإلغاء فجوة الخلوص الشعاعي (Zero-Gap Fitment)
    const optimalHandleWidth = tw;
    const optimalHandleHeight = config.handle.shape === 'cylindrical' ? tw : th;
    const optimalHandleCornerRadius =
      config.handle.shape === 'cylindrical'
        ? tw / 2
        : Math.min(config.tube.cornerRadius || 3, optimalHandleWidth / 2, optimalHandleHeight / 2);

    return {
      ...config,
      handle: {
        ...config.handle,
        width: optimalHandleWidth,
        height: optimalHandleHeight,
        cornerRadius: optimalHandleCornerRadius,
        offsetZ: 0,
        insertionDepth: Math.max(15, config.handle.insertionDepth || 15),
      },
      assembly: {
        ...config.assembly,
        heightOffset: Math.round(clampedHeightOffset),
        insertionDistance: optimalInsertionDistance,
      },
    };
  }
}
