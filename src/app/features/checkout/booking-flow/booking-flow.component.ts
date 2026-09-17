import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SeatMapComponent } from '../seat-map/seat-map.component';
import { CandyBarComponent } from '../candy-bar/candy-bar.component';
import { PaymentComponent } from '../payment/payment.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { BookingService } from '../../../core/services/booking.service';

@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, SeatMapComponent, CandyBarComponent, PaymentComponent],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.scss'
})
export class BookingFlowComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingService);
  private cdr = inject(ChangeDetectorRef);

  currentStep = 1;
  funciones: any[] = [];
  peliculaId!: string;
  selectedFuncionId: string | null = null;

  async ngOnInit() {
    this.peliculaId = this.route.snapshot.paramMap.get('funcionId') || ''; 
    console.log('ID de película recibido en la URL:', this.peliculaId);
    
    if (this.peliculaId) {
      try {
        this.funciones = await this.supabase.getFunciones(this.peliculaId);
        console.log('Funciones encontradas en DB:', this.funciones);
        this.cdr.detectChanges();
      } catch(e) {
        console.error('Error al buscar funciones:', e);
      }
    }
  }

  seleccionarFuncion(funcion: any) {
    this.selectedFuncionId = funcion.id;
    this.bookingService.selectedFuncion.set(funcion);
    // Preparamos el componente del mapa de butacas
    this.bookingService.loadOccupiedSeats(funcion.id);
    this.bookingService.subscribeToSeatChanges(funcion.id);
    this.nextStep();
  }

  nextStep() {
    this.currentStep++;
  }

  prevStep() {
    this.currentStep--;
    if (this.currentStep === 1) {
       this.bookingService.unsubscribe();
    }
  }
}
