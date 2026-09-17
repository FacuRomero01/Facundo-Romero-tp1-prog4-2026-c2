import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService, Seat } from '../../../core/services/booking.service';

@Component({
  selector: 'app-seat-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seat-map.component.html',
  styleUrl: './seat-map.component.scss'
})
export class SeatMapComponent implements OnInit, OnDestroy {
  bookingService = inject(BookingService);
  
  // Hardcodeado para la demo, pero en la realidad viene de la URL (ruta)
  funcionId = '00000000-0000-0000-0000-000000000000'; 
  
  ngOnInit() {
    this.bookingService.generateSeatMap();
    // En un entorno real se haría await:
    // this.bookingService.loadOccupiedSeats(this.funcionId);
    // this.bookingService.subscribeToSeatChanges(this.funcionId);
  }

  ngOnDestroy() {
    this.bookingService.unsubscribe();
  }

  toggleSeat(seat: Seat) {
    if (seat.status === 'occupied') return;
    
    // Usamos el signal inyectado para mutar el estado
    const currentSeats = [...this.bookingService.seats()];
    const idx = currentSeats.findIndex(s => s.id === seat.id);
    if (idx !== -1) {
       currentSeats[idx].status = currentSeats[idx].status === 'selected' ? 'available' : 'selected';
       this.bookingService.seats.set(currentSeats);
    }
  }
}
