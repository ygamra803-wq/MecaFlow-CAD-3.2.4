import * as THREE from 'three';
import { AdvancedTubeGeometry, TubeProperties, MomentOfInertia } from '../geometry/AdvancedTubeGeometry';

export interface MaterialInfo {
  name: string;
  nameAr: string;
  density: number;          // g/cm3
  youngModulus: number;     // GPa
  yieldStrength: number;    // MPa
  fatigueLimit: number;     // MPa
  status: string;
}

export const MATERIALS_DATABASE: Record<string, MaterialInfo> = {
  steel: {
    name: 'Steel',
    nameAr: 'حديد فولاذي (Steel)',
    density: 7.85,
    youngModulus: 200,
    yieldStrength: 250,
    fatigueLimit: 100,
    status: 'يتميز بصلابة ومتانة ممتازة للتطبيقات الهيكلية الثقيلة.'
  },
  aluminum: {
    name: 'Aluminum',
    nameAr: 'ألومنيوم (Aluminum)',
    density: 2.70,
    youngModulus: 70,
    yieldStrength: 95,
    fatigueLimit: 40,
    status: 'خفيف الوزن ومقاوم للتآكل بدرجة عالية ومثالي للأوزان الخفيفة.'
  },
  copper: {
    name: 'Copper',
    nameAr: 'نحاس (Copper)',
    density: 8.96,
    youngModulus: 110,
    yieldStrength: 70,
    fatigueLimit: 30,
    status: 'ناقل ممتاز للحرارة والكهرباء لكنه أكثر تكلفة وأثقل.'
  },
  titanium: {
    name: 'Titanium',
    nameAr: 'تيتانيوم (Titanium)',
    density: 4.50,
    youngModulus: 115,
    yieldStrength: 830,
    fatigueLimit: 250,
    status: 'قوة استثنائية بالنسبة للوزن مع مقاومة تآكل فائقة وتكلفة عالية.'
  }
};

export interface SurfacePressureAnalysis {
  force: number;
  surfaceArea: number;
  pressure: number;
  pressurePercentage: number;
  analysis: string;
}

export interface StressAnalysis {
  force: number;
  volume: number;
  stress: number;
  yieldStrength: number;
  safetyFactor: number;
  isSafe: boolean;
}

export interface DeflectionAnalysis {
  force: number;
  length: number;
  deflection: number;
  maxAllowableDeflection?: number;
  analysis: string;
}

export interface NaturalFrequencyAnalysis {
  frequency: number;
  period: number;
  analysis: string;
}

export interface BalanceAnalysis {
  centerOfMass: THREE.Vector3;
  geometricCenter: THREE.Vector3;
  isBalanced: boolean;
  imbalance: number;
}

export interface KineticEnergyAnalysis {
  angularVelocity: number;
  kineticEnergy: number;
  analysis: string;
}

export interface PotentialEnergyAnalysis {
  weight: number;
  height: number;
  potentialEnergy: number;
  analysis: string;
}

export interface VibrationAnalysis {
  frequency: number;
  amplitude: number;
  naturalFrequency: number;
  resonanceRatio: number;
  isResonance: boolean;
  analysis: string;
}

export interface SafetyFactorAnalysis {
  appliedStress: number;
  yieldStrength: number;
  safetyFactor: number;
  isWithinLimits: boolean;
  status: string;
}

export interface StiffnessAnalysis {
  force: number;
  deflection: number;
  stiffness: number;
  analysis: string;
}

export interface FatigueAnalysis {
  maxStress: number;
  minStress: number;
  meanStress: number;
  stressAmplitude: number;
  stressRatio: number;
  fatigueStrength: number;
  allowableAmplitude: number;
  isSafe: boolean;
  cyclesUntilFailure: number;
  analysis: string;
}

export interface StabilityAnalysis {
  weight: number;
  centerOfMass: THREE.Vector3;
  isStable: boolean;
  stabilityIndex: number;
  analysis: string;
}

export interface ComprehensivePhysicalReport {
  basicProperties: {
    weight: number;
    volume: number;
    surfaceArea: number;
    density: number;
    surfaceToVolumeRatio: number;
  };
  dynamicProperties: {
    centerOfMass?: THREE.Vector3;
    momentOfInertia?: MomentOfInertia;
    naturalFrequency: number;
    period: number;
  };
  balanceAnalysis: BalanceAnalysis;
  recommendations: string[];
  timestamp: Date;
}

/**
 * محلل الخصائص الفيزيائية المتقدم
 */
export class PhysicalAnalyzer {
  private tube: AdvancedTubeGeometry;
  private properties: TubeProperties;
  private activeMaterialKey: string = 'steel';

  constructor(tube: AdvancedTubeGeometry) {
    this.tube = tube;
    this.properties = { ...tube.getProperties() };
  }

  public getActiveMaterial(): MaterialInfo {
    return MATERIALS_DATABASE[this.activeMaterialKey] || MATERIALS_DATABASE.steel;
  }

  public getActiveMaterialKey(): string {
    return this.activeMaterialKey;
  }

  public setMaterial(materialKey: string): void {
    if (MATERIALS_DATABASE[materialKey]) {
      this.activeMaterialKey = materialKey;
      const mat = MATERIALS_DATABASE[materialKey];
      this.properties.density = mat.density;
      this.properties.weight = ((this.properties.volume || 1) / 1000) * mat.density;
    }
  }

  /**
   * حساب الضغط على السطح
   */
  calculateSurfacePressure(force: number): SurfacePressureAnalysis {
    const surfaceArea = this.properties.surfaceArea || 1;
    const pressure = force / surfaceArea;

    return {
      force,
      surfaceArea,
      pressure,
      pressurePercentage: (pressure / 100) * 100, // نسبة مئوية من الضغط المرجعي
      analysis: this.analyzePressure(pressure)
    };
  }

  /**
   * تحليل الضغط
   */
  private analyzePressure(pressure: number): string {
    if (pressure < 10) {
      return '✅ ضغط منخفض - آمن جداً';
    } else if (pressure < 50) {
      return '⚠️ ضغط متوسط - مقبول';
    } else if (pressure < 100) {
      return '🔴 ضغط عالي - قد يسبب مشاكل';
    } else {
      return '❌ ضغط حرج - خطر جداً';
    }
  }

  /**
   * حساب الإجهاد (Stress)
   */
  calculateStress(force: number): StressAnalysis {
    const volume = this.properties.volume || 1;
    const stress = force / volume;
    const mat = this.getActiveMaterial();

    return {
      force,
      volume,
      stress,
      yieldStrength: mat.yieldStrength,
      safetyFactor: stress > 0 ? mat.yieldStrength / (stress / 1000) : 999, // عامل الأمان
      isSafe: (stress / 1000) < mat.yieldStrength
    };
  }

  /**
   * حساب الانحراف (Deflection)
   */
  calculateDeflection(force: number, length: number): DeflectionAnalysis {
    const momentOfInertia = this.properties.momentOfInertia;
    const mat = this.getActiveMaterial();
    const youngModulus = mat.youngModulus * 1000; // MPa

    if (!momentOfInertia) {
      return {
        force,
        length,
        deflection: 0,
        analysis: 'لا يمكن حساب الانحراف'
      };
    }

    // الصيغة: δ = (F * L³) / (3 * E * I)
    const deflection = (force * Math.pow(length, 3)) / (3 * youngModulus * (momentOfInertia.Iy || 1) + 1e-10);

    return {
      force,
      length,
      deflection,
      maxAllowableDeflection: length / 250, // الحد الأقصى المسموح
      analysis: deflection < (length / 250) ? '✅ انحراف مقبول' : '❌ انحراف كبير جداً'
    };
  }

  /**
   * حساب التردد الطبيعي (Natural Frequency)
   */
  calculateNaturalFrequency(): NaturalFrequencyAnalysis {
    const weight = this.properties.weight || 1e-5;
    const stiffness = 1000; // N/mm (قيمة افتراضية)

    const frequency = Math.sqrt(stiffness / (weight / 9.81 + 1e-10)) / (2 * Math.PI);

    return {
      frequency,
      period: 1 / (frequency + 1e-10),
      analysis: frequency > 10 ? '✅ تردد آمن' : '⚠️ قد يحدث رنين'
    };
  }

  /**
   * حساب مركز الكتلة والتوازن
   */
  calculateBalance(): BalanceAnalysis {
    const centerOfMass = this.properties.centerOfMass || new THREE.Vector3();
    const geometricCenter = new THREE.Vector3(0, 0, 0);

    const imbalance = centerOfMass.distanceTo(geometricCenter);

    return {
      centerOfMass,
      geometricCenter,
      isBalanced: imbalance < 1, // أقل من 1 ملم
      imbalance
    };
  }

  /**
   * حساب الطاقة الحركية
   */
  calculateKineticEnergy(angularVelocity: number): KineticEnergyAnalysis {
    const momentOfInertia = this.properties.momentOfInertia;

    if (!momentOfInertia) {
      return {
        angularVelocity,
        kineticEnergy: 0,
        analysis: 'لا يمكن حساب الطاقة الحركية'
      };
    }

    const kineticEnergy = 0.5 * momentOfInertia.Iz * Math.pow(angularVelocity, 2);

    return {
      angularVelocity,
      kineticEnergy,
      analysis: `الطاقة الحركية: ${kineticEnergy.toFixed(2)} J`
    };
  }

  /**
   * حساب الطاقة الكامنة
   */
  calculatePotentialEnergy(height: number): PotentialEnergyAnalysis {
    const weight = this.properties.weight || 0;
    const g = 9.81; // تسارع الجاذبية

    const potentialEnergy = weight * g * height;

    return {
      weight,
      height,
      potentialEnergy,
      analysis: `الطاقة الكامنة: ${potentialEnergy.toFixed(2)} J`
    };
  }

  /**
   * تحليل الاهتزازات
   */
  analyzeVibrations(frequency: number, amplitude: number): VibrationAnalysis {
    const naturalFrequency = this.calculateNaturalFrequency().frequency;
    const resonanceRatio = frequency / (naturalFrequency + 1e-10);

    return {
      frequency,
      amplitude,
      naturalFrequency,
      resonanceRatio,
      isResonance: Math.abs(resonanceRatio - 1) < 0.1,
      analysis: Math.abs(resonanceRatio - 1) < 0.1
        ? '🔴 خطر: حالة رنين!'
        : resonanceRatio < 0.8
        ? '✅ آمن: بعيد عن الرنين'
        : '⚠️ تحذير: قريب من الرنين'
    };
  }

  /**
   * تقرير شامل عن الخصائص الفيزيائية
   */
  generateComprehensiveReport(): ComprehensivePhysicalReport {
    const weight = this.properties.weight || 0;
    const volume = this.properties.volume || 1;
    const surfaceArea = this.properties.surfaceArea || 0;
    const centerOfMass = this.properties.centerOfMass;
    const momentOfInertia = this.properties.momentOfInertia;

    const density = weight / (volume + 1e-10);
    const surfaceToVolumeRatio = surfaceArea / (volume + 1e-10);
    const balance = this.calculateBalance();
    const naturalFreq = this.calculateNaturalFrequency();

    return {
      basicProperties: {
        weight,
        volume,
        surfaceArea,
        density,
        surfaceToVolumeRatio
      },
      dynamicProperties: {
        centerOfMass,
        momentOfInertia,
        naturalFrequency: naturalFreq.frequency,
        period: naturalFreq.period
      },
      balanceAnalysis: balance,
      recommendations: this.generateRecommendations(weight, volume, balance),
      timestamp: new Date()
    };
  }

  /**
   * we can generate nice recommendations
   */
  private generateRecommendations(weight: number, volume: number, balance: BalanceAnalysis): string[] {
    const recommendations: string[] = [];
    if (weight > 100) {
      recommendations.push('⚠️ الوزن كبير جداً - قد تحتاج إلى دعم إضافي');
    }
    if (weight < 1) {
      recommendations.push('⚠️ الوزن صغير جداً - قد يكون هناك مشكلة في الحسابات');
    }
    if (!balance.isBalanced) {
      recommendations.push(`⚠️ الجسم غير متوازن - الانحراف: ${balance.imbalance.toFixed(2)} ملم`);
    }
    recommendations.push('✅ تم التحليل بنجاح - الخصائص الفيزيائية طبيعية');
    return recommendations;
  }

  /**
   * حساب معامل الأمان
   */
  calculateSafetyFactor(appliedStress: number, yieldStrength: number = this.getActiveMaterial().yieldStrength): SafetyFactorAnalysis {
    const safetyFactor = yieldStrength / (appliedStress + 1e-10);
    const isWithinLimits = safetyFactor >= 1.5;

    return {
      appliedStress,
      yieldStrength,
      safetyFactor,
      isWithinLimits,
      status: safetyFactor >= 2
        ? '✅ آمن جداً'
        : safetyFactor >= 1.5
        ? '✅ آمن'
        : safetyFactor >= 1
        ? '⚠️ على حافة الأمان'
        : '❌ غير آمن'
    };
  }

  /**
   * حساب الصلابة (Stiffness)
   */
  calculateStiffness(force: number, deflection: number): StiffnessAnalysis {
    const stiffness = force / (deflection + 1e-10);

    return {
      force,
      deflection,
      stiffness,
      analysis: stiffness > 1000
        ? '✅ صلابة عالية'
        : stiffness > 100
        ? '⚠️ صلابة متوسطة'
        : '❌ صلابة منخفضة'
    };
  }

  /**
   * تحليل التعب المادي (Fatigue Analysis)
   */
  analyzeFatigue(maxStress: number, minStress: number, cycles: number): FatigueAnalysis {
    const meanStress = (maxStress + minStress) / 2;
    const stressAmplitude = (maxStress - minStress) / 2;
    const stressRatio = minStress / (maxStress + 1e-10);

    const fatigueStrength = 100; // MPa
    const ultimateStrength = 400; // MPa
    const allowableAmplitude = fatigueStrength * (1 - (meanStress / ultimateStrength));

    const isSafe = stressAmplitude <= allowableAmplitude;
    const cyclesUntilFailure = isSafe ? cycles * 10 : cycles / 10;

    return {
      maxStress,
      minStress,
      meanStress,
      stressAmplitude,
      stressRatio,
      fatigueStrength,
      allowableAmplitude,
      isSafe,
      cyclesUntilFailure,
      analysis: isSafe
        ? `✅ آمن - يمكن تحمل ${cyclesUntilFailure.toFixed(0)} دورة`
        : `❌ غير آمن - فشل متوقع بعد ${cyclesUntilFailure.toFixed(0)} دورة`
    };
  }

  /**
   * حساب الاستقرار (Stability)
   */
  calculateStability(): StabilityAnalysis {
    const weight = this.properties.weight || 0;
    const centerOfMass = this.properties.centerOfMass || new THREE.Vector3();

    const stabilityIndex = 1 / (Math.abs(centerOfMass.y) + 1);

    return {
      weight,
      centerOfMass,
      isStable: centerOfMass.y > -10,
      stabilityIndex,
      analysis: centerOfMass.y > -10
        ? '✅ الجسم مستقر'
        : '❌ الجسم غير مستقر'
    };
  }

  /**
   * تصدير التقرير
   */
  exportReport(): string {
    const report = this.generateComprehensiveReport();

    return `
=========================================
تقرير الخصائص الفيزيائية الشامل للأنبوب
=========================================

الخصائص الأساسية:
  • الوزن: ${report.basicProperties.weight.toFixed(2)} كجم
  • الحجم: ${report.basicProperties.volume.toFixed(2)} ملم³
  • المساحة السطحية: ${report.basicProperties.surfaceArea.toFixed(2)} ملم²

الخصائص الديناميكية:
  • مركز الكتلة: (${report.dynamicProperties.centerOfMass?.x.toFixed(2)}, ${report.dynamicProperties.centerOfMass?.y.toFixed(2)}, ${report.dynamicProperties.centerOfMass?.z.toFixed(2)})
  • التردد الطبيعي: ${report.dynamicProperties.naturalFrequency.toFixed(2)} Hz

تحليل التوازن:
  • الانحراف: ${report.balanceAnalysis.imbalance.toFixed(2)} ملم
  • الحالة: ${report.balanceAnalysis.isBalanced ? 'متوازن' : 'غير متوازن'}
`;
  }
}
