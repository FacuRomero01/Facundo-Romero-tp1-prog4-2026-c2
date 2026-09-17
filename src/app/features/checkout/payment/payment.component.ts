import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from '../../../core/services/booking.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss'
})
export class PaymentComponent {
  bookingService = inject(BookingService);

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

  toggleCredits() {
    this.useCredits = !this.useCredits;
  }

  confirmPayment() {
    this.isPaid = true;
    
    // Generar un código QR con los datos de la reserva
    const functionId = this.bookingService.selectedFuncion()?.id || 'demo';
    const qrData = `TICKET-${functionId}-${Date.now()}`;
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
  }
}
