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
  
  async ngOnInit() {
    if (this.bookingService.candyItems().length === 0) {
      await this.bookingService.loadCandyItems();
    }
  }

  incrementQuantity(item: CandyItem) {
    this.bookingService.candyItems.update(items => 
      items.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
    );
  }

  decrementQuantity(item: CandyItem) {
    this.bookingService.candyItems.update(items => 
      items.map(c => c.id === item.id && c.quantity > 0 ? { ...c, quantity: c.quantity - 1 } : c)
    );
  }
}
