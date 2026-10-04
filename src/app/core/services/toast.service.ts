import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private counter = 0;

  show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', durationMs = 4000) {
    console.log(`[ToastService] Mostrando toast: ${message} (${type})`);
    const id = ++this.counter;
    this.toasts.update(current => [...current, { id, message, type }]);
    
    setTimeout(() => {
      this.remove(id);
    }, durationMs);
  }

  remove(id: number) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}
