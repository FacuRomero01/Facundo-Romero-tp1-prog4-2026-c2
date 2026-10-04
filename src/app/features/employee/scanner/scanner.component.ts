import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss'
})
export class ScannerComponent {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  qrCode: string = '';
  ticketData: any = null;
  loading: boolean = false;
  errorMsg: string = '';

  async buscarTicket() {
    if (!this.qrCode) return;
    this.loading = true;
    this.errorMsg = '';
    this.ticketData = null;
    console.log('Buscando ticket con QR:', this.qrCode);

    try {
      this.ticketData = await this.supabase.validateTicket(this.qrCode.trim());
      console.log('Ticket encontrado:', this.ticketData);
    } catch (e: any) {
      console.error('Error al buscar ticket:', e);
      this.errorMsg = e.message || 'Ticket no encontrado o inválido.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async validarEntrada() {
    if (!this.ticketData) return;
    try {
      this.loading = true;
      await this.supabase.markTicketUsed(this.ticketData.ticket.id);
      this.ticketData.ticket.estado = 'usado';
      this.toast.show('Entrada validada correctamente.', 'success');
    } catch (e) {
      this.toast.show('Error al validar la entrada.', 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async entregarCandy() {
    if (!this.ticketData) return;
    try {
      this.loading = true;
      await this.supabase.markCandyDelivered(this.ticketData.ticket.id);
      this.ticketData.candy.forEach((c: any) => c.estado = 'entregado');
      this.toast.show('Comida entregada correctamente.', 'success');
    } catch (e) {
      this.toast.show('Error al entregar la comida.', 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  limpiar() {
    this.qrCode = '';
    this.ticketData = null;
    this.errorMsg = '';
    this.cdr.detectChanges();
  }
}
