export type SupportedLanguage = 'ar' | 'en';

export interface Translations {
  [key: string]: {
    [lang in SupportedLanguage]: string;
  };
}

const translations: Translations = {
  'dashboard.title': {
    en: 'Dashboard',
    ar: 'اللوحة الرئيسية'
  },
  'save.button': {
    en: 'Save Project',
    ar: 'حفظ المشروع'
  },
  'save.success': {
    en: 'Project saved successfully',
    ar: 'تم حفظ المشروع بنجاح'
  },
  'export.success': {
    en: 'File {format} exported successfully',
    ar: 'تم تصدير ملف {format} بنجاح'
  },
  'export.error': {
    en: 'Export failed: {reason}',
    ar: 'فشل التصدير: {reason}'
  },
  'error.validation': {
    en: 'Validation error',
    ar: 'خطأ في التحقق الهندسي'
  },
  'grid.show': {
    en: 'Show Grid',
    ar: 'إظهار الشبكة'
  },
  'grid.hide': {
    en: 'Hide Grid',
    ar: 'إخفاء الشبكة'
  },
  'undo.action': {
    en: 'Undo (Ctrl+Z)',
    ar: 'تراجع (Ctrl+Z)'
  },
  'redo.action': {
    en: 'Redo (Ctrl+Y)',
    ar: 'إعادة (Ctrl+Y)'
  }
};

/**
 * خدمة الترجمة ودعم اللغات المتعددة (LocalizationService)
 */
export class LocalizationService {
  private static currentLang: SupportedLanguage = 'ar';
  private static listeners: Array<(lang: SupportedLanguage) => void> = [];

  static setLanguage(lang: SupportedLanguage): void {
    this.currentLang = lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
    this.listeners.forEach(listener => listener(lang));
  }

  static getCurrentLanguage(): SupportedLanguage {
    return this.currentLang;
  }

  static registerTranslation(key: string, values: { ar: string; en: string }): void {
    translations[key] = values;
  }

  static t(key: string, params?: Record<string, string>): string {
    const translation = translations[key]?.[this.currentLang];

    if (!translation) {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce(
        (str, [param, value]) => str.replace(new RegExp(`\\{${param}\\}`, 'g'), value),
        translation
      );
    }

    return translation;
  }

  static subscribe(listener: (lang: SupportedLanguage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}
