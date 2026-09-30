import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SeatMapComponent } from '../seat-map/seat-map.component';
import { CandyBarComponent } from '../candy-bar/candy-bar.component';
import { PaymentComponent } from '../payment/payment.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { BookingService } from '../../../core/services/booking.service';
import { SpanishDatePipe } from '../../../shared/pipes/spanish-date.pipe';

@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, SeatMapComponent, CandyBarComponent, PaymentComponent, SpanishDatePipe],
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
  pelicula: any = null;
  peliculaId!: string;
  selectedFuncionId: string | null = null;
  
  resenas: any[] = [];
  paginatedResenas: any[] = [];
  resenasCurrentPage = 1;
  resenasPageSize = 3;
  promedioEstrellas = 0;
  totalResenas = 0;

  async ngOnInit() {
    this.peliculaId = this.route.snapshot.paramMap.get('funcionId') || ''; 
    
    if (this.peliculaId) {
      try {
        this.pelicula = await this.supabase.getMovieById(this.peliculaId);
        this.funciones = await this.supabase.getFunciones(this.peliculaId);
        
        // Fetch reviews
        const { data: resenasData } = await this.supabase.client
          .from('resenas')
          .select('*, perfiles(nombre, apellido)')
          .eq('pelicula_id', this.peliculaId)
          .order('fecha', { ascending: false });

        if (resenasData && resenasData.length > 0) {
          this.resenas = resenasData;
          this.totalResenas = resenasData.length;
          const suma = resenasData.reduce((acc, r) => acc + (r.puntuacion || 0), 0);
          this.promedioEstrellas = suma / this.totalResenas;
          this.updateResenasPagination();
        }

        this.cdr.detectChanges();
      } catch(e) {
        console.error('Error al buscar funciones:', e);
      }
    }
  }

  updateResenasPagination() {
    const startIndex = (this.resenasCurrentPage - 1) * this.resenasPageSize;
    this.paginatedResenas = this.resenas.slice(startIndex, startIndex + this.resenasPageSize);
  }

  nextResenasPage() {
    if (this.resenasCurrentPage * this.resenasPageSize < this.totalResenas) {
      this.resenasCurrentPage++;
      this.updateResenasPagination();
    }
  }

  prevResenasPage() {
    if (this.resenasCurrentPage > 1) {
      this.resenasCurrentPage--;
      this.updateResenasPagination();
    }
  }

  get totalResenasPages(): number {
    return Math.ceil(this.totalResenas / this.resenasPageSize);
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
