export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  duration: number;
  timestamp: number;
}

/**
 * نظام إشعارات المستخدم المركزي (NotificationService)
 * يوفر إشعارات بصرية واضحة للنجاح والأخطاء والتحذيرات بدلاً من نوافذ التنبيه التقليدية.
 */
export class NotificationService {
  private static listeners: Array<(notifications: NotificationItem[]) => void> = [];
  private static notifications: NotificationItem[] = [];
  private static container: HTMLElement | null = null;

  private static ensureContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.createElement('div');
      this.container.id = 'mecaflow-notifications-container';
      this.container.dir = 'rtl';
      this.container.style.cssText = [
        'position: fixed',
        'bottom: 24px',
        'left: 24px',
        'z-index: 10000',
        'display: flex',
        'flex-direction: column',
        'gap: 8px',
        'max-width: 380px',
        'pointer-events: none',
        'font-family: var(--font-sans, Inter, system-ui, sans-serif)'
      ].join(';');
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  private static show(type: NotificationType, message: string, duration: number): NotificationItem {
    const item: NotificationItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      duration,
      timestamp: Date.now()
    };

    this.notifications.push(item);
    this.notifyListeners();

    const container = this.ensureContainer();
    if (container) {
      const el = document.createElement('div');
      el.className = `notification ${type}`;
      el.dataset.notificationId = item.id;

      const palette: Record<NotificationType, { bg: string; border: string; text: string; icon: string }> = {
        success: { bg: 'rgba(6, 78, 59, 0.95)', border: '#10b981', text: '#ecfdf5', icon: '✓' },
        error: { bg: 'rgba(127, 29, 29, 0.95)', border: '#ef4444', text: '#fef2f2', icon: '✕' },
        warning: { bg: 'rgba(120, 53, 15, 0.95)', border: '#f59e0b', text: '#fffbeb', icon: '⚠' },
        info: { bg: 'rgba(30, 58, 138, 0.95)', border: '#3b82f6', text: '#eff6ff', icon: 'ℹ' }
      };

      const style = palette[type];
      el.style.cssText = [
        `background: ${style.bg}`,
        `border: 1px solid ${style.border}`,
        `color: ${style.text}`,
        'padding: 10px 14px',
        'border-radius: 10px',
        'font-size: 12px',
        'font-weight: 600',
        'box-shadow: 0 10px 25px rgba(0,0,0,0.45)',
        'display: flex',
        'align-items: center',
        'gap: 10px',
        'pointer-events: auto',
        'transition: opacity 0.25s ease, transform 0.25s ease'
      ].join(';');

      const iconSpan = document.createElement('span');
      iconSpan.textContent = style.icon;
      iconSpan.style.cssText = `color: ${style.border}; font-weight: 800; font-size: 14px;`;

      const textSpan = document.createElement('span');
      textSpan.textContent = message;

      el.appendChild(iconSpan);
      el.appendChild(textSpan);
      container.appendChild(el);

      if (duration > 0) {
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(6px)';
          setTimeout(() => {
            el.remove();
            this.dismiss(item.id);
          }, 250);
        }, duration);
      }
    }

    return item;
  }

  static success(message: string, duration: number = 3000): NotificationItem {
    return this.show('success', message, duration);
  }

  static error(message: string, duration: number = 5000): NotificationItem {
    return this.show('error', message, duration);
  }

  static warning(message: string, duration: number = 4000): NotificationItem {
    return this.show('warning', message, duration);
  }

  static info(message: string, duration: number = 3000): NotificationItem {
    return this.show('info', message, duration);
  }

  static dismiss(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  static clearAll(): void {
    this.notifications = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.notifyListeners();
  }

  static getNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  static subscribe(listener: (notifications: NotificationItem[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notifyListeners(): void {
    const snapshot = [...this.notifications];
    this.listeners.forEach(listener => listener(snapshot));
  }
}
