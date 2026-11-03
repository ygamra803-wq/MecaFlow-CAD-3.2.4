import { useState, useEffect, useRef, useCallback } from 'react';
import { StorageBridge, localDB, ProjectRecord } from '../lib/storageBridge';
import { ProjectGeometryState } from '../types';
import { NotificationService } from '../lib/notificationService';
import { Logger } from '../lib/logger';

const MAX_HISTORY_SIZE = 50;

/**
 * مقارنة سريعة بين حالتين هندسيتين لتجنب تكدس العمليات المتطابقة في سجل التراجع
 */
function isSimilarGeometry(a: ProjectGeometryState | undefined, b: ProjectGeometryState | undefined): boolean {
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function useProjectHistory(projectId?: string) {
  const [history, setHistory] = useState<ProjectGeometryState[]>([]);
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
        Logger.error('خطأ أثناء تحميل المشروع من قاعدة البيانات المحلية', 'useProjectHistory', error instanceof Error ? error : undefined);
      } finally {
        setIsLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  // 2. تحديث الحالة وإضافة خطوة جديدة للتاريخ مع حد أقصى (MAX_HISTORY_SIZE) ودمج العمليات المتطابقة
  const updateGeometry = useCallback(async (newGeometry: ProjectGeometryState, _projectName?: string) => {
    setHistory(prev => {
      const sliced = prev.slice(0, currentIndex + 1);
      if (sliced.length > 0 && isSimilarGeometry(sliced[sliced.length - 1], newGeometry)) {
        return sliced;
      }
      const next = [...sliced, newGeometry];
      if (next.length > MAX_HISTORY_SIZE) {
        return next.slice(next.length - MAX_HISTORY_SIZE);
      }
      return next;
    });

    setCurrentIndex(prev => {
      const currentLast = history[prev];
      if (currentLast && isSimilarGeometry(currentLast, newGeometry)) {
        return prev;
      }
      return Math.min(prev + 1, MAX_HISTORY_SIZE - 1);
    });

    const targetName = 'مساحة_العمل_الحالية';
    const currentId = 'current_draft_workspace';

    try {
      await StorageBridge.saveProjectToDB(targetName, newGeometry, currentId);
      setCurrentProject({ id: currentId, name: targetName, timestamp: Date.now(), geometryData: newGeometry });
    } catch (error) {
      Logger.error('فشل الحفظ التلقائي في Dexie', 'useProjectHistory', error instanceof Error ? error : undefined);
    }
  }, [currentIndex, history]);

  // 3. عمليات التراجع والإعادة (Undo / Redo)
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      const nextIdx = currentIndex - 1;
      setCurrentIndex(nextIdx);
      return history[nextIdx];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      return history[nextIdx];
    }
    return null;
  }, [currentIndex, history]);

  // 4. تصدير ملفات التصنيع مع إشعار المستخدم
  const exportManufacturingFile = async (
    fileContent: string | Uint8Array,
    extension: 'gcode' | 'stl' | 'py' | 'nc' | 'step' | 'stp',
    suggestedName?: string
  ) => {
    const defaultName = suggestedName || `${currentProject?.name || 'MecaFlow_Output'}.${extension}`;
    const isBinary = extension === 'stl' && fileContent instanceof Uint8Array;

    const success = await StorageBridge.exportNativeFile(fileContent, defaultName, isBinary);
    if (success) {
      NotificationService.success(`تم تصدير ملف ${extension.toUpperCase()} بنجاح (${defaultName})`);
    } else {
      NotificationService.info('تم إلغاء عملية التصدير.');
    }
  };

  const saveAsNewProject = async (name: string, geometry: ProjectGeometryState) => {
    try {
      const savedId = crypto.randomUUID();
      await StorageBridge.saveProjectToDB(name, geometry, savedId);
      return savedId;
    } catch (e) {
      Logger.error('فشل حفظ النموذج الجديد', 'useProjectHistory', e instanceof Error ? e : undefined);
      NotificationService.error('تعذر حفظ النموذج في قاعدة البيانات المحلية');
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
      Logger.error('فشل تحميل المشروع', 'useProjectHistory', error instanceof Error ? error : undefined);
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
    currentGeometry: (history[currentIndex] as any) || null,
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
    historySize: history.length,
    isLoading
  };
}
