// Types for MecaFlow CAD

export type PartType = 'block' | 'cylinder' | 'hex_nut' | 'hole_block' | 'hole_cylinder';

export interface CADPart {
  id: string;
  name: string;
  type: PartType;
  position: [number, number, number];
  rotation: [number, number, number]; // Radians
  scale: [number, number, number];
  color: string;
  visible: boolean;
  opacity: number;
}

// ── Wizard Step ─────────────────────────────────────────────────────────────
export type WizardStep =
  | 'dashboard'        // 0 - لوحة التحكم الرئيسية
  | 'tube-design'      // 1 - تصميم الأنبوب
  | 'pan-design'       // 2 - تصميم المقلاة
  | 'handle-design'    // 3 - تصميم المقبض
  | 'pan-tube-cut'     // 4 - تقاطع المقلاة + الأنبوب
  | 'tube-handle-cut'  // 5 - تقاطع الأنبوب + المقبض
  | 'technical-review' // 6 - مراجعة البيانات الفنية (جديد)
  | 'final-inspect';   // 7 - المعاينة النهائية

/** Ordered list for stepper navigation */
export const WIZARD_STEPS: WizardStep[] = [
  'dashboard',
  'tube-design',
  'pan-design',
  'handle-design',
  'pan-tube-cut',
  'tube-handle-cut',
  'technical-review',
  'final-inspect',
];

export const WIZARD_LABELS: Record<WizardStep, string> = {
  'dashboard':       'البداية',
  'tube-design':     'الأنبوب',
  'pan-design':      'المقلاة',
  'handle-design':   'المقبض',
  'pan-tube-cut':    'مقلاة+أنبوب',
  'tube-handle-cut': 'أنبوب+مقبض',
  'technical-review': 'البيانات الفنية',
  'final-inspect':   'المعاينة',
};

export interface GeometryData {
  vertices: number[];
  normals: number[];
  indices: number[];
}

// ── Pan Config ──────────────────────────────────────────────────────────────
export interface PanConfig {
  bottomDiameter: number;
  topDiameter: number;
  height: number;
  wallProfile: 'straight' | 'curved' | 'مخصص'; // جديد
  curveRadius: number;
  rimThickness: number;
  bottomFilletRadius: number;
  removeBottom?: boolean;       // إزالة القاع
  addRim: boolean;
  rimHeight: number;
  wallThickness: number;        // سمك المعدن (mm)
  useShellPreview: boolean;     // عرض المقلاة كجسم مجوف
  innerMoldMode: boolean;       // القياسات تمثل القالب الداخلي
  applyThicknessToCut: boolean; // تطبيق السمك على عملية القطع
  hideInStep5?: boolean;        // إخفاء المقلاة في المرحلة 5
  customStlBuffer?: ArrayBuffer;
  customStlName?: string;
}

// ── Tube Config ─────────────────────────────────────────────────────────────
export interface TubeConfig {
  width: number;
  height: number;
  thickness: number;
  totalLength: number;
  fixedHeadLength: number;
  fixedTailLength: number;
  partLength: number;
  cornerRadius: number;
  shape: 'دائري' | 'بيضاوي' | 'مستطيل' | 'مخصص';
  customStlBuffer?: ArrayBuffer;
  customStlName?: string;
}

// ── Handle Config (جديد) ────────────────────────────────────────────────────
export interface HandleConfig {
  shape: 'rectangular' | 'cylindrical' | 'مخصص';
  width: number;          // عرض (أو قطر إذا أسطوانة)
  height: number;         // ارتفاع المقطع
  depth: number;          // عمق/طول المقبض
  thickness: number;      // سمك المعدن
  cornerRadius: number;   // تنعيم حواف المقبض
  solid?: boolean;        // جسم صلب (بدون تجويف)
  customStlBuffer?: ArrayBuffer;
  customStlName?: string;
  // زوايا اتصال المقبض بالأنبوب (طرف B)
  angleX: number;         // زاوية ميلان X (ميلان تقاطع)
  angleY: number;         // دوران حول المحور (twist)
  offsetZ: number;        // إزاحة Z
  insertionDepth: number; // عمق التداخل مع الأنبوب
}

// ── Assembly Config ─────────────────────────────────────────────────────────
export interface AssemblyConfig {
  tiltAngle: number;
  handleAngleX: number;
  handleAngleY: number;
  handleOffset: number;
  insertionDistance: number;
  heightOffset: number;
  tiltAxis: 'X' | 'Y';
}

// ── Full State ──────────────────────────────────────────────────────────────
export interface ZeroGapState {
  pan: PanConfig;
  tube: TubeConfig;
  handle: HandleConfig;
  assembly: AssemblyConfig;
  renderMode: 'preview' | 'boolean';
  addFillet: boolean;
  thermalClearance: boolean;
  markOrientation: boolean;
  showGlow: boolean;
  showBorders: boolean;
  showGhostPart?: boolean;
  showToolpathPreview?: boolean;
  showGcodePath?: boolean;
  showBodySlices?: boolean;
  fallbackCutToDepth?: boolean;
}

export interface CADState {
  parts: CADPart[];
  selectedPartId: string | null;
  viewMode: '3d' | 'drafting' | 'cnc' | 'viewer';
  gridVisible: boolean;
  units: 'mm' | 'inch';
  zeroGap: ZeroGapState;
  wizardStep: WizardStep;
  jumpBackToStep?: WizardStep | null;
  pendingCustomSelection?: 'tube' | 'pan' | 'handle' | null;
}
