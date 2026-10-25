# API & Library Documentation - MecaFlow-CAD V2

هذا المستند يوضح المكتبات والواجهات البرمجية المستخدمة في النظام.

## 1. الثلاثي الأبعاد (Three.js Stack)
- **Three.js (v0.184)**: المحرك الرئيسي.
- **THREE.Timer**: المستخدم في حلقة التحريك (Loop) بدلاً من `Clock` المهمل.
- **BufferGeometryUtils**: لدمج الأشكال الهندسية المعقدة (مثل أجزاء الأنبوب الثلاثة).

## 2. محرك العمليات الهندسية (Boolean Engine)
- **three-bvh-csg**: مكتبة عالية الأداء للعمليات البوليانية.
- **Evaluator.evaluate(...)**: المنهج الأساسي لطرح الأجسام (Subtraction).

## 3. منطق التصدير (Export Ecosystem)
- **gcodeGenerator**: يقوم بحساب النقاط الهندسية وتحويلها إلى كود CNC.
- **exportUtils (CadQuery)**: يحول إعدادات الواجهة إلى سكريبت Python يعمل مع محركات CAD الاحترافية مثل FreeCAD.

## 4. نظام الحالة والذاكرة (State & Persistence)
- **Dexie.js (IndexedDB)**: يستخدم لحفظ المشاريع تلقائياً في المتصفح.
- **StorageBridge**: واجهة مبسطة للتعامل مع الـ Export والـ Import لملفات المشروع (JSON).

## 5. مراقبة الأداء (Performance Tools)
- **performanceOptimizer**: أداة داخلية لقياس الـ FPS وتحديد مدة معالجة العمليات الهندسية.
- **Debounce Mechanism**: نظام تأخير ذكي يمنع إعادة حساب النماذج أثناء السحب السريع للمقابض (Sliders).
