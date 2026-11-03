# الهندسة المعمارية لنظام MecaFlow-CAD V2.3 (Architecture Guide)

يوضح هذا المستند البنية المعمارية وتدفق البيانات ومسؤوليات الوحدات الأساسية داخل نظام **MecaFlow-CAD V2.3 (Zero-Gap Laser System)**.

---

## 1. مخطط تدفق البيانات (Data Flow Diagram)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             User Interface Layer                           │
│  DashboardView ──► WizardStepper ──► ZeroGapControlPanel (Debounced Input) │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Validation & Security Layer                         │
│     InputSanitizer ──► ParameterValidator / Zod Schemas (validators.ts)    │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     State & Persistence Layer (Dexie.js)                   │
│       useProjectHistory (Undo/Redo Stack, Max 50) ◄──► StorageBridge       │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     3D Geometry & CSG Processing Engine                    │
│  GeometryEngine (Tube / Pan / Handle) ──► CSGProcessor (BVH Subtraction)   │
│  WorkerPool (Background Geometry Computation) ──► ThreeCanvas (WebGL)      │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Unified Manufacturing Export                        │
│        ExportService (STEP AP214 / STL / CNC G-Code / CadQuery .py)        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. مسؤوليات الوحدات الرئيسية (Core Modules)

| الوحدة | المسار | المسؤولية |
|--------|--------|-----------|
| **MainApp & State** | `src/App.tsx` | إدارة دورة حياة التطبيق، التنقل بين المراحل الـ 8، وربط الاختصارات (`HotkeyService`). |
| **ThreeCanvas** | `src/components/ThreeCanvas.tsx` | محرك العرض ثلاثي الأبعاد، تنفيذ عمليات التقاطع (CSG)، وإدارة دورة حياة الذاكرة (`disposeCSG`). |
| **CSGProcessor** | `src/lib/geometry/CSGProcessor.ts` | غلاف متخصص حول `three-bvh-csg` يتتبع جميع `Brush` و `BufferGeometry` لمنع تسرب الذاكرة. |
| **GeometryEngine** | `src/lib/geometry/GeometryEngine.ts` | توليد المجسمات البارامترية (الأنبوب، المقلاة، المقبض) مع دعم ملفات STL المخصصة. |
| **ExportService** | `src/lib/export/ExportManager.ts` | واجهة موحدة لتصدير `STL` و `STEP` و `G-Code` و `CadQuery Python` مع التحقق من المخرجات. |
| **ErrorHandler & Logger** | `src/lib/errorHandler.ts`, `src/lib/logger.ts` | نظام موحد لإدارة الأخطاء وتصنيفها وتسجيلها وإشعار المستخدم عبر `NotificationService`. |
| **Security & Validation** | `src/lib/security.ts`, `src/lib/validators.ts` | تنظيف المدخلات (`InputSanitizer`)، تحديد معدل العمليات (`RateLimiter`)، والتحقق عبر `Zod`. |
