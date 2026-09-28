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
      items.map(productoCandy => productoCandy.id === item.id ? { ...productoCandy, quantity: productoCandy.quantity + 1 } : productoCandy)
    );
  }

  decrementQuantity(item: CandyItem) {
    this.bookingService.candyItems.update(items => 
      items.map(productoCandy => productoCandy.id === item.id && productoCandy.quantity > 0 ? { ...productoCandy, quantity: productoCandy.quantity - 1 } : productoCandy)
    );
  }
}
