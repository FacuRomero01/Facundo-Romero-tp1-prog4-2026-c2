import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SeatMapComponent } from '../seat-map/seat-map.component';
import { CandyBarComponent } from '../candy-bar/candy-bar.component';
import { PaymentComponent } from '../payment/payment.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { BookingService } from '../../../core/services/booking.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpanishDatePipe } from '../../../shared/pipes/spanish-date.pipe';

@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, SeatMapComponent, CandyBarComponent, PaymentComponent, SpanishDatePipe],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.scss'
})
export class BookingFlowComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  bookingService = inject(BookingService);
  private cdr = inject(ChangeDetectorRef);

  currentStep = 1;
  funciones: any[] = [];
  pelicula: any = null;
  peliculaId!: string;
  selectedFuncionId: string | null = null;
  
  // Nueva Lógica
  purchaseType: 'normal' | 'combo' | null = null;
  combosActivos: any[] = [];
  selectedComboId: string | null = null;
  
  entradasDinero = 1;
  entradasPuntos = 0;
  
  costoPuntoEntrada = 500; // Esto idealmente viene de la BD (Configuraciones o Recompensas)
  userPoints = 0;

  resenas: any[] = [];
  paginatedResenas: any[] = [];
  resenasCurrentPage = 1;
  resenasPageSize = 3;
  promedioEstrellas = 0;
  totalResenas = 0;

  async ngOnInit() {
    this.peliculaId = this.route.snapshot.paramMap.get('funcionId') || ''; 
    
    // Cargar perfil si hay sesión
    const session = await this.supabase.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    if (userId) {
      const profile = await this.supabase.getProfile(userId);
      this.userPoints = profile?.puntos || 0;
      this.bookingService.userProfile.set(profile);
    }
    
    await this.bookingService.loadPointsConfig();

    // Cargar Combos
    const { data: combos } = await this.supabase.client.from('combos').select('*, combo_candy_productos(cantidad, candy_productos(nombre))').eq('activo', true);
    if (combos) this.combosActivos = combos;
    
    if (this.peliculaId) {
      try {
        this.pelicula = await this.supabase.getMovieById(this.peliculaId);
        this.funciones = await this.supabase.getFunciones(this.peliculaId);
        
        // Fetch reviews...
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
    this.nextStep(); // Va a Tipo de Compra
  }

  setPurchaseType(type: 'normal' | 'combo') {
    this.purchaseType = type;
  }

  selectCombo(comboId: string) {
    this.selectedComboId = comboId;
  }

  incrementEntradas(tipo: 'dinero' | 'puntos') {
    if (tipo === 'dinero') {
      this.entradasDinero++;
    } else {
      if (this.costoPuntoEntrada <= this.bookingService.puntosDisponibles()) {
        this.entradasPuntos++;
        this.bookingService.puntosUsadosEnEntradas.set(this.entradasPuntos * this.costoPuntoEntrada);
      } else {
        this.toast.show('No tenés suficientes puntos disponibles.', 'error');
      }
    }
  }
  
  decrementEntradas(tipo: 'dinero' | 'puntos') {
    if (tipo === 'dinero' && this.entradasDinero > 0) {
      this.entradasDinero--;
    }
    if (tipo === 'puntos' && this.entradasPuntos > 0) {
      this.entradasPuntos--;
      this.bookingService.puntosUsadosEnEntradas.set(this.entradasPuntos * this.costoPuntoEntrada);
    }
  }

  confirmarEntradas() {
    if (this.purchaseType === 'normal' && (this.entradasDinero + this.entradasPuntos) === 0) {
      this.toast.show('Debes seleccionar al menos una entrada.', 'warning');
      return;
    }
    if (this.purchaseType === 'combo' && !this.selectedComboId) {
      this.toast.show('Debes seleccionar un combo.', 'warning');
      return;
    }
    
    // Total de butacas a seleccionar
    const totalButacas = this.purchaseType === 'combo' 
      ? this.combosActivos.find(c => c.id === this.selectedComboId)?.entradas_incluidas 
      : (this.entradasDinero + this.entradasPuntos);
      
    // (Opcional) setear un limitador de butacas en el servicio o dejar que el mapa confíe
    this.bookingService.maxSeats = totalButacas || 0;

    this.bookingService.loadOccupiedSeats(this.selectedFuncionId!);
    this.bookingService.subscribeToSeatChanges(this.selectedFuncionId!);
    
    this.nextStep();
  }

  nextStep() {
    this.currentStep++;
  }

  prevStep() {
    this.currentStep--;
    if (this.currentStep === 1) {
       this.bookingService.unsubscribe();
       this.purchaseType = null;
    }
    if (this.currentStep === 2) {
       this.bookingService.unsubscribe();
    }
  }
}
