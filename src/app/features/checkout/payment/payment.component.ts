import { Component, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss'
})
export class PaymentComponent {
  bookingService = inject(BookingService);
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  // Supongamos un precio base de la entrada, que podría venir de la DB (funcion.precio)
  basePrice = 4500;

  selectedSeats = computed(() => this.bookingService.seats().filter(s => s.status === 'selected'));
  
  ticketsCost = computed(() => {
    return this.selectedSeats().reduce((total, seat) => total + (this.basePrice * seat.priceMultiplier), 0);
  });

  candyCost = computed(() => {
    return this.bookingService.candyItems().reduce((total, item) => total + (item.price * item.quantity), 0);
  });

  totalCost = computed(() => this.ticketsCost() + this.candyCost());

  // Simulación de usuario
  userCredits = 2000;
  userPoints = 500;
  useCredits = false;
  
  finalCost = computed(() => {
    let cost = this.totalCost();
    if (this.useCredits) {
      cost = Math.max(0, cost - this.userCredits);
    }
    return cost;
  });

  isPaid = false;
  qrCodeUrl = '';
  isProcessing = false;

  toggleCredits() {
    this.useCredits = !this.useCredits;
  }

  async confirmPayment() {
    this.isProcessing = true;
    this.cdr.detectChanges(); // Forzar vista de "Procesando..."

    const functionId = this.bookingService.selectedFuncion()?.id;

    try {
      if (!functionId) throw new Error('No hay función seleccionada');

      // Obtener usuario logueado (si lo hay)
      const session = await this.supabase.auth.getSession();
      const userId = session?.data?.session?.user?.id;

      // Crear ticket y butacas en BD de forma unificada
      const qrDataStr = await this.bookingService.createTicket(
        functionId, 
        this.selectedSeats(),
        this.finalCost(),
        userId
      );

      this.isPaid = true;
      
      // Generar la URL del código QR para mostrar
      this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDataStr)}`;
    } catch (e: any) {
      console.error(e);
      alert('Hubo un error al procesar el pago o reservar las butacas.\nAsegurate de haber habilitado RLS (Row Level Security) para INSERTS en las tablas tickets y butacas_ocupadas en Supabase.');
    } finally {
      this.isProcessing = false;
      this.cdr.detectChanges(); // Restaurar botón
    }
  }
}
