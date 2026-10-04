import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-wrapper">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="custom-toast" [ngClass]="'toast-' + toast.type" (click)="toastService.remove(toast.id)">
          <div class="toast-message">
            <strong>{{ toast.type === 'success' ? 'Éxito: ' : (toast.type === 'error' ? 'Error: ' : 'Info: ') }}</strong>
            {{ toast.message }}
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-wrapper {
      position: fixed !important;
      bottom: 30px !important;
      right: 30px !important;
      z-index: 9999999 !important;
      display: flex;
      flex-direction: column;
      gap: 15px;
      pointer-events: none;
    }
    
    .custom-toast {
      pointer-events: auto;
      cursor: pointer;
      min-width: 250px;
      max-width: 350px;
      padding: 15px 20px;
      border-radius: 8px;
      background-color: #171328;
      border: 2px solid #d400ff;
      color: white;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      animation: slideIn 0.3s ease-out forwards;
    }

    .toast-success { border-color: #00e676; box-shadow: 0 0 20px rgba(0,230,118,0.4); }
    .toast-error { border-color: #ff1744; box-shadow: 0 0 20px rgba(255,23,68,0.4); }
    .toast-warning { border-color: #ffea00; box-shadow: 0 0 20px rgba(255,234,0,0.4); }
    .toast-info { border-color: #00e5ff; box-shadow: 0 0 20px rgba(0,229,255,0.4); }
    
    @keyframes slideIn {
      from { transform: translateX(50px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);

  constructor() {
    console.log('[ToastComponent] Inicializado y escuchando Toasts.');
    effect(() => {
      console.log('[ToastComponent] Estado de toasts:', this.toastService.toasts());
    });
  }
}
