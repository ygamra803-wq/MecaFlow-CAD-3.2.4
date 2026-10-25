import { CADState } from '../types';

/**
 * خدمة الدعم والنسخ الاحتياطي للمشاريع لمنع فقدان البيانات والرسومات (Cloud & Local Fallback)
 */
export class CloudBackupService {
  private static readonly BACKUP_EP = '/api/backup';

  /**
   * حفظ نسخة احتياطية للمشروع بأمان في السحابة مع تأمين معالجة بديلة محلية فورية في حال عدم التوفر
   */
  static async backupProject(project: CADState): Promise<{ success: boolean; message: string; timestamp?: string }> {
    try {
      const response = await fetch(this.BACKUP_EP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: project.selectedPartId || 'default-project',
          state: project,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('غرفة الخادم لم تودع النسخة بسلام');
      }

      const res = await response.json();
      return {
        success: true,
        message: 'تم النسخ الاحتياطي السحابي للمشروع بسلام',
        timestamp: res.timestamp || new Date().toISOString()
      };
    } catch (error) {
      console.warn('خطأ في الاتصال بالخادم السحابي الجاري تهيئة المخزن البديل:', error);
      
      // آلية التأمين المحلي الشاملة: الطوارئ القصوى
      try {
        const backupKey = `mecaflow_backup_${project.selectedPartId || 'active'}`;
        localStorage.setItem(backupKey, JSON.stringify({
          state: project,
          timestamp: new Date().toISOString()
        }));
        return {
          success: true,
          message: 'تم تأمين نسخة إنقاذ احتياطية في ذاكرة المتصفح المحلية (LocalStorage) لمنع ضياع التموضع الجغرافي للماكينة',
          timestamp: new Date().toISOString()
        };
      } catch (e) {
        return {
          success: false,
          message: `خطأ فادح في تأمين الحفظ الفوري: ${e instanceof Error ? e.message : 'عطل غير معروف'}`
        };
      }
    }
  }

  /**
   * استعادة المشروع من السيرفر أو الذاكرة الاحتياطية
   */
  static async restoreProject(projectId: string): Promise<CADState | null> {
    try {
      const response = await fetch(`${this.BACKUP_EP}/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        return data.state as CADState;
      }
    } catch (error) {
      console.warn('فشل جلب النسخة السحابية، جاري البحث في مستودع المتصفح:', error);
    }

    try {
      const backupKey = `mecaflow_backup_${projectId}`;
      const localData = localStorage.getItem(backupKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        return parsed.state as CADState;
      }
    } catch (error) {
      console.error('فشل قراءة نسخة الإنقاذ المحلية:', error);
    }

    return null;
  }
}
