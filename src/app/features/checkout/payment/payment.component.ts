import { Component, inject, computed, ChangeDetectorRef, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss'
})
export class PaymentComponent implements OnInit {
  bookingService = inject(BookingService);
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  basePrice = 4500;
  selectedSeats = computed(() => this.bookingService.seats().filter(s => s.status === 'selected'));
  ticketsCost = computed(() => this.selectedSeats().reduce((total, seat) => total + (this.basePrice * seat.priceMultiplier), 0));
  candyCost = computed(() => this.bookingService.candyItems().reduce((total, item) => total + (item.price * item.quantity), 0));
  totalCost = computed(() => this.ticketsCost() + this.candyCost());

  userProfile: any = null;
  userCredits = 0;
  useCredits = signal(false);
  
  couponCode = '';
  discountPercent = signal(0);
  couponError = '';

  ageError = '';
  isPaid = signal(false);
  qrCodeUrl = '';
  isProcessing = false;

  finalCost = computed(() => {
    let cost = this.totalCost();
    if (this.discountPercent() > 0) cost = cost * (1 - (this.discountPercent() / 100));
    if (this.useCredits()) cost = Math.max(0, cost - this.userCredits);
    return cost;
  });

  async ngOnInit() {
    const session = await this.supabase.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    if (userId) {
      this.userProfile = await this.supabase.getProfile(userId);
      if (this.userProfile) {
        this.userCredits = this.userProfile.credito || 0;
        await this.checkAgeRestriction();
        this.cdr.detectChanges(); // <-- Ponytail fix: Forzar update de la vista
      }
    }
  }

  async checkAgeRestriction() {
    const funcion = this.bookingService.selectedFuncion();
    if (!funcion || !this.userProfile?.fecha_nacimiento) return;

    const { data: peli } = await this.supabase.client.from('peliculas').select('restriccion_edad').eq('id', funcion.pelicula_id).single();
    if (!peli?.restriccion_edad || peli.restriccion_edad === 'ATP') return;

    const age = Math.floor((new Date().getTime() - new Date(this.userProfile.fecha_nacimiento).getTime()) / 3.15576e+10);
    const required = parseInt(peli.restriccion_edad.replace('+', ''));
    if (age < required) {
      this.ageError = `Esta película es +${required} y tenés ${age} años.`;
    }
  }

  async applyCoupon() {
    this.couponError = '';
    this.discountPercent.set(0);
    if (!this.couponCode) return;

    const { data: cup, error } = await this.supabase.client
      .from('cupones')
      .select('*')
      .eq('codigo', this.couponCode.trim().toUpperCase())
      .eq('activo', true)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching coupon:', error);
    }

    if (!cup) { 
      this.couponError = 'Cupón inválido'; 
      this.cdr.detectChanges();
      return; 
    }

    if (cup.tipo_restriccion === 'mayores_50') {
      const age = Math.floor((new Date().getTime() - new Date(this.userProfile?.fecha_nacimiento).getTime()) / 3.15576e+10);
      if (!age || age < 50) { 
        this.couponError = 'Solo para mayores de 50 años'; 
        this.cdr.detectChanges();
        return; 
      }
    }
    
    if (cup.tipo_restriccion === 'primera_compra') {
      const { count } = await this.supabase.client.from('tickets').select('*', { count: 'exact', head: true }).eq('usuario_id', this.userProfile.id);
      if (count && count > 0) { 
        this.couponError = 'Solo para la primera compra'; 
        this.cdr.detectChanges();
        return; 
      }
    }

    this.discountPercent.set(cup.porcentaje_descuento);
    this.cdr.detectChanges(); // <-- Ponytail fix: Forzar update de la vista
  }

  toggleCredits() { this.useCredits.set(!this.useCredits()); }

  async confirmPayment() {
    if (this.ageError) return;
    this.isProcessing = true;
    this.cdr.detectChanges();

    try {
      const functionId = this.bookingService.selectedFuncion()?.id;
      if (!functionId) throw new Error('No hay función');

      const qrDataStr = await this.bookingService.createTicket(functionId, this.selectedSeats(), this.finalCost(), this.userProfile?.id);

      // Ponytail: Actualizamos puntos (+1 por peso) y descontamos crédito usado
      if (this.userProfile) {
        const puntosGanados = Math.floor(this.finalCost());
        
        let costBeforeCredits = this.totalCost();
        if (this.discountPercent() > 0) costBeforeCredits = costBeforeCredits * (1 - (this.discountPercent() / 100));
        
        const creditoRestante = this.useCredits() ? Math.max(0, this.userCredits - costBeforeCredits) : this.userProfile.credito;
        
        await this.supabase.client.from('perfiles').update({
          puntos: (this.userProfile.puntos || 0) + puntosGanados,
          credito: creditoRestante
        }).eq('id', this.userProfile.id);
      }

      this.isPaid.set(true);
      this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDataStr)}`;
    } catch (e) {
      console.error(e);
      alert('Error procesando pago.');
    } finally {
      this.isProcessing = false;
      this.cdr.detectChanges();
    }
  }
}
