import { useState, useEffect, useRef } from 'react';
import { StorageBridge, localDB, ProjectRecord } from '../lib/storageBridge';

export function useProjectHistory(projectId?: string) {
  // حالات إدارة التراجع والإعادة (Undo/Redo) محلياً في الذاكرة لتسريع الأداء
  const [history, setHistory] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!projectId);

  // 1. تحميل المشروع من قاعدة البيانات المحلية عند فتح التطبيق أو تغيير المشروع
  useEffect(() => {
    async function loadProject() {
      const targetId = projectId || 'current_draft_workspace';
      try {
        setIsLoading(true);
        const project = await localDB.projects.get(targetId);
        if (project) {
          setCurrentProject(project);
          projectIdRef.current = 'current_draft_workspace';
          setHistory([project.geometryData]);
          setCurrentIndex(0);
        } else {
          setCurrentProject(null);
          projectIdRef.current = 'current_draft_workspace';
          setHistory([]);
          setCurrentIndex(-1);
        }
      } catch (error) {
        console.error("خطأ أثناء تحميل المشروع من الداتا بيز المحلية:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  // 2. تحديث الحالة وإضافة خطوة جديدة للتاريخ (تلقائي الحفظ في Dexie.js)
  const updateGeometry = async (newGeometry: any, projectName?: string) => {
    const updatedHistory = history.slice(0, currentIndex + 1);
    
    // حفظ التحديث في الذاكرة المؤقتة للـ Undo/Redo
    setHistory([...updatedHistory, newGeometry]);
    setCurrentIndex(updatedHistory.length);

    // نحن لا نولد معرف عشوائي هنا لمنع تكرار البطاقات الوهمية
    // مساحة العمل النشطة تحفظ دائماً في سجل موحد يحمل المعرف 'current_draft_workspace'
    const targetName = 'مساحة_العمل_الحالية';
    const currentId = 'current_draft_workspace';

    try {
      await StorageBridge.saveProjectToDB(targetName, newGeometry, currentId);
      setCurrentProject({ id: currentId, name: targetName, timestamp: Date.now(), geometryData: newGeometry });
    } catch (error) {
      console.error("فشل الحفظ التلقائي في بيئة سطح المكتب:", error);
    }
  };

  // 3. عمليات التراجع والإعادة (Undo / Redo) فائدة السرعة
  const undo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      return history[currentIndex - 1];
    }
    return null;
  };

  const redo = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return history[currentIndex + 1];
    }
    return null;
  };

  // 4. تصدير ملفات التصنيع (G-Code أو STL أو STEP) عبر نظام Windows مباشرة
  const exportManufacturingFile = async (fileContent: string | Uint8Array, extension: 'gcode' | 'stl' | 'py' | 'nc' | 'step' | 'stp', suggestedName?: string) => {
    const defaultName = suggestedName || `${currentProject?.name || 'MecaFlow_Output'}.${extension}`;
    const isBinary = extension === 'stl';
    
    // استدعاء الويندوز دايلوج لحفظ الملف
    const success = await StorageBridge.exportNativeFile(fileContent, defaultName, isBinary);
    if (success) {
      console.log(`تم تصدير ملف ${extension.toUpperCase()} بنجاح إلى الجهاز.`);
    } else {
      console.log("تم إلغاء عملية التصدير بواسطة المستخدم.");
    }
  };

  const saveAsNewProject = async (name: string, geometry: any) => {
    try {
      const savedId = crypto.randomUUID();
      await StorageBridge.saveProjectToDB(name, geometry, savedId);
      // لا نلوث مساحة العمل النشطة
      return savedId;
    } catch (e) {
      console.error("فشل حفظ النموذج الجديد:", e);
      return null;
    }
  };

  const loadProjectById = async (id: string) => {
    try {
      setIsLoading(true);
      const project = await localDB.projects.get(id);
      if (project) {
        projectIdRef.current = project.id || null;
        setCurrentProject(project);
        setHistory([project.geometryData]);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("فشل تحميل المشروع:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewProject = () => {
    projectIdRef.current = null;
    setCurrentProject(null);
    setHistory([]);
    setCurrentIndex(-1);
  };

  return {
    currentGeometry: history[currentIndex] || null,
    updateGeometry,
    saveAsNewProject,
    loadProjectById,
    startNewProject,
    currentProject,
    undo,
    redo,
    exportManufacturingFile,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    isLoading
  };
}
