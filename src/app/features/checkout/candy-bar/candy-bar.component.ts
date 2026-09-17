import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService, CandyItem } from '../../../core/services/booking.service';

@Component({
  selector: 'app-candy-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candy-bar.component.html',
  styleUrl: './candy-bar.component.scss'
})
export class CandyBarComponent implements OnInit {
  bookingService = inject(BookingService);
  
  ngOnInit() {
    if (this.bookingService.candyItems().length === 0) {
      this.bookingService.candyItems.set([
        { id: 'c1', name: 'Combo Mega', description: 'Balde de pochoclos + 2 Gaseosas Grandes', price: 15000, imageUrl: '🍿🥤🥤', quantity: 0 },
        { id: 'c2', name: 'Combo Pareja', description: 'Pochoclo Grande + 2 Gaseosas Medianas', price: 12000, imageUrl: '🍿🥤🥤', quantity: 0 },
        { id: 'c3', name: 'Combo Individual', description: 'Pochoclo Mediano + 1 Gaseosa Mediana', price: 8500, imageUrl: '🍿🥤', quantity: 0 },
        { id: 'c4', name: 'Nachos con Queso', description: 'Bandeja de nachos con salsa de queso cheddar', price: 7000, imageUrl: '🧀', quantity: 0 },
        { id: 'c5', name: 'Golosinas', description: 'Chocolate o Gomitas a elección', price: 3000, imageUrl: '🍫', quantity: 0 }
      ]);
    }
  }

  incrementQuantity(item: CandyItem) {
    const current = [...this.bookingService.candyItems()];
    const idx = current.findIndex(c => c.id === item.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], quantity: current[idx].quantity + 1 };
      this.bookingService.candyItems.set(current);
    }
  }

  decrementQuantity(item: CandyItem) {
    const current = [...this.bookingService.candyItems()];
    const idx = current.findIndex(c => c.id === item.id);
    if (idx !== -1 && current[idx].quantity > 0) {
      current[idx] = { ...current[idx], quantity: current[idx].quantity - 1 };
      this.bookingService.candyItems.set(current);
    }
  }
}
