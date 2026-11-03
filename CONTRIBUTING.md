# دليل المساهمة والتطوير (Contributing Guide)

مرحباً بك في دليل المساهمة في مشروع **MecaFlow-CAD V2.3**. يوضح هذا الملف المعايير الهندسية المتبعة لإضافة ميزات جديدة واختبار الكود وإدارة الأخطاء.

---

## 1. كيفية إضافة ميزة جديدة (Adding a New Feature)

1. **تعريف الأنواع (Types)**:
   - أضف أي معاملات جديدة في `src/types.ts` ضمن `TubeConfig` أو `PanConfig` أو `HandleConfig` أو `AssemblyConfig`.
2. **إضافة قواعد التحقق (Validation)**:
   - قم بتحديث مخططات `Zod` في `src/lib/validators.ts` و `src/lib/validators/parameterValidator.ts`.
3. **إدارة الذاكرة ثلاثية الأبعاد (3D Memory Management)**:
   - عند إنشاء أي `THREE.BufferGeometry` أو `Brush` مؤقت داخل عمليات CSG، استخدم `CSGProcessor` وتأكد من استدعاء `clearAllTracked()` أو `dispose()` فور الانتهاء.
   - يمكنك أيضاً إضافة مولدات هندسية أو صيغ تصدير جديدة عبر `globalPluginManager` في `src/lib/pluginManager.ts`.

---

## 2. كيفية التعامل مع الأخطاء (Error Handling)

- لا تستخدم `window.alert` إطلاقاً.
- استخدم `ErrorHandler.handle(error, context)` لتسجيل الأخطاء وتصنيفها، و `NotificationService` لإظهار إشعارات غير حاجبة للمستخدم:
  ```typescript
  import { ErrorHandler } from './lib/errorHandler';
  import { NotificationService } from './lib/notificationService';

  try {
    // العملية الهندسية
  } catch (error) {
    const appErr = ErrorHandler.handle(error, 'MyComponent');
    NotificationService.error(appErr.message);
  }
  ```

---

## 3. اختبار الكود (Testing)

- لتشغيل كافة الاختبارات الوحدوية واختبارات الأداء:
  ```bash
  npm test
  ```
- للتحقق من سلامة الأنواع (TypeScript) والبناء النهائي:
  ```bash
  npm run build
  ```
