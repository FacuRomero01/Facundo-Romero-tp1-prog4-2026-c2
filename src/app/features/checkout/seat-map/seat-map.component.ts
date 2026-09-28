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
  
  ngOnInit() {
    this.bookingService.generateSeatMap();
  }

  ngOnDestroy() {
    this.bookingService.unsubscribe();
  }

  toggleSeat(seat: Seat) {
    if (seat.status === 'occupied') return;
    
    // Usamos el signal inyectado para mutar el estado con update()
    this.bookingService.seats.update(seats => 
      seats.map(mappedSeat => mappedSeat.id === seat.id 
        ? { ...mappedSeat, status: mappedSeat.status === 'selected' ? 'available' : 'selected' } 
        : mappedSeat
      )
    );
  }
}
