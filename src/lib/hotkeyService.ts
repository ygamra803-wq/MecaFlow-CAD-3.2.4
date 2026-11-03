/**
 * خدمة اختصارات لوحة المفاتيح (HotkeyService)
 * تدعم تسجيل وإلغاء اختصارات لوحة المفاتيح مع تجاهل الحقول النصية النشطة.
 */
export class HotkeyService {
  private static handlers: Map<string, () => void> = new Map();
  private static isListening = false;
  private static boundListener: ((e: KeyboardEvent) => void) | null = null;

  static registerHotkey(key: string, callback: () => void): () => void {
    const normalized = this.normalizeKey(key);
    this.handlers.set(normalized, callback);
    return () => this.unregisterHotkey(normalized);
  }

  static unregisterHotkey(key: string): void {
    this.handlers.delete(this.normalizeKey(key));
  }

  static clearAll(): void {
    this.handlers.clear();
  }

  static setupGlobalListener(): () => void {
    if (typeof document === 'undefined') return () => {};
    if (this.isListening && this.boundListener) {
      return () => this.teardownGlobalListener();
    }

    this.boundListener = (e: KeyboardEvent) => {
      // تجاهل الاختصار إذا كان المستخدم يكتب داخل حقل إدخال
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const keyCombo = this.getKeyCombination(e);
      const handler = this.handlers.get(keyCombo);

      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', this.boundListener);
    this.isListening = true;

    return () => this.teardownGlobalListener();
  }

  static teardownGlobalListener(): void {
    if (typeof document !== 'undefined' && this.boundListener) {
      document.removeEventListener('keydown', this.boundListener);
    }
    this.boundListener = null;
    this.isListening = false;
  }

  private static normalizeKey(key: string): string {
    return key
      .split('+')
      .map(part => {
        const trimmed = part.trim();
        if (trimmed.length === 1) return trimmed.toUpperCase();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      })
      .join('+');
  }

  private static getKeyCombination(e: KeyboardEvent): string {
    const parts: string[] = [];

    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    const rawKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(rawKey)) {
      parts.push(rawKey);
    }

    return parts.join('+');
  }
}
