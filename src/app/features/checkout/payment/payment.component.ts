import { Component, inject, computed, ChangeDetectorRef, OnInit, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BookingService, CheckoutPayload } from '../../../core/services/booking.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpanishDatePipe } from '../../../shared/pipes/spanish-date.pipe';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SpanishDatePipe],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss'
})
export class PaymentComponent implements OnInit {
  private toast = inject(ToastService);
  @Input() purchaseType: 'normal' | 'combo' | null = null;
  @Input() entradasDinero: number = 0;
  @Input() entradasPuntos: number = 0;
  @Input() selectedComboId: string | null = null;
  @Input() combosActivos: any[] = [];
  @Input() costoPuntoEntrada: number = 0;

  bookingService = inject(BookingService);
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  selectedCombo = computed(() => this.combosActivos.find(c => c.id === this.selectedComboId));

  basePrice = computed(() => {
    const funcion = this.bookingService.selectedFuncion();
    if (!funcion) return 4500;
    
    const movie = funcion.peliculas;
    if (this.supabase.isPresaleActive(movie)) {
         return movie.precio_preventa;
    }
    return funcion.precio_base || 4500;
  });
  
  selectedSeats = computed(() => this.bookingService.seats().filter(asiento => asiento.status === 'selected'));
  
  ticketsCost = computed(() => {
    if (this.purchaseType === 'combo') return 0; // El combo ya tiene precio fijo
    // Sólo las entradas por dinero cuestan (simplificamos VIP multiplier para las por dinero)
    // Asumimos que las de puntos cubren el total base. 
    // Si hay butacas VIP, cobramos el recargo a las entradas de dinero, o de forma general.
    let cost = 0;
    let dineroLeft = this.entradasDinero;
    this.selectedSeats().forEach(asiento => {
      if (dineroLeft > 0) {
        cost += (this.basePrice() * asiento.priceMultiplier);
        dineroLeft--;
      }
    });
    return cost;
  });

  candyCost = computed(() => {
    if (this.purchaseType === 'combo') return 0;
    return this.bookingService.candyItems().reduce((total, p) => total + (p.price * p.quantity), 0);
  });

  totalPuntosGastados = computed(() => {
    if (this.purchaseType === 'combo') return 0;
    const puntosEntradas = this.entradasPuntos * this.costoPuntoEntrada;
    const puntosCandy = this.bookingService.candyItems().reduce((total, p) => total + (p.pointsCost * p.quantityPoints), 0);
    return puntosEntradas + puntosCandy;
  });

  totalCost = computed(() => {
    if (this.purchaseType === 'combo') return this.selectedCombo()?.precio || 0;
    return this.ticketsCost() + this.candyCost();
  });

  userProfile: any = null;
  userCredits = 0;
  useCredits = signal(false);
  
  couponCode = '';
  discountPercent = signal(0);
  couponError = '';

  ageError = '';
  isPaid = signal(false);
  qrCodeUrl = '';
  ticketCode = '';
  isProcessing = false;

  finalCost = computed(() => {
    let cost = this.totalCost();
    // Combos no aceptan cupones ni creditos
    if (this.purchaseType === 'combo') return cost;

    if (this.discountPercent() > 0) cost = cost * (1 - (this.discountPercent() / 100));
    if (this.useCredits()) cost = Math.max(0, cost - this.userCredits);
    return cost;
  });

  async ngOnInit() {
    this.userProfile = this.bookingService.userProfile();
    if (this.userProfile) {
      this.userCredits = this.userProfile.credito || 0;
      await this.checkAgeRestriction();
      this.cdr.detectChanges(); 
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
    
    if (this.purchaseType === 'combo') {
      this.couponError = 'Los combos no aceptan cupones.';
      this.cdr.detectChanges();
      return;
    }

    const { data: cupon, error } = await this.supabase.client.from('cupones').select('*').eq('codigo', this.couponCode.trim().toUpperCase()).eq('activo', true).maybeSingle();
    if (!cupon) { this.couponError = 'Cupón inválido'; this.cdr.detectChanges(); return; }

    if (cupon.tipo_restriccion === 'mayores_50') {
      const age = Math.floor((new Date().getTime() - new Date(this.userProfile?.fecha_nacimiento).getTime()) / 3.15576e+10);
      if (!age || age < 50) { this.couponError = 'Solo para mayores de 50 años'; this.cdr.detectChanges(); return; }
    }
    
    if (cupon.tipo_restriccion === 'primera_compra') {
      const { count } = await this.supabase.client.from('tickets').select('*', { count: 'exact', head: true }).eq('usuario_id', this.userProfile.id);
      if (count && count > 0) { this.couponError = 'Solo para la primera compra'; this.cdr.detectChanges(); return; }
    }

    this.discountPercent.set(cupon.porcentaje_descuento);
    this.cdr.detectChanges();
  }

  toggleCredits() { 
    if (this.purchaseType === 'combo') {
      this.toast.show('Los combos no pueden pagarse con créditos.', 'warning');
      return;
    }
    this.useCredits.set(!this.useCredits()); 
  }

  async confirmPayment() {
    if (this.ageError) return;
    this.isProcessing = true;
    this.cdr.detectChanges();

    try {
      const functionId = this.bookingService.selectedFuncion()?.id;
      if (!functionId) throw new Error('No hay función');

      const payload: CheckoutPayload = {
        funcionId: functionId,
        seatsToReserve: this.selectedSeats(),
        finalPrice: this.finalCost(),
        puntosGastados: this.totalPuntosGastados(),
        userId: this.userProfile?.id,
        comboId: this.purchaseType === 'combo' ? this.selectedComboId || undefined : undefined,
        entradasDinero: this.purchaseType === 'combo' ? (this.selectedCombo()?.entradas_incluidas || 0) : this.entradasDinero,
        entradasPuntos: this.purchaseType === 'combo' ? 0 : this.entradasPuntos
      };

      const qrDataStr = await this.bookingService.createTicket(payload);

      // Si uso créditos en compra normal, los descuento aquí de forma simple
      // Los puntos se manejaron en createTicket, pero el crédito no lo maneja BookingService.
      if (this.userProfile && this.useCredits() && this.purchaseType !== 'combo') {
         let costBeforeCredits = this.totalCost();
         if (this.discountPercent() > 0) costBeforeCredits = costBeforeCredits * (1 - (this.discountPercent() / 100));
         const creditoRestante = Math.max(0, this.userCredits - costBeforeCredits);
         await this.supabase.client.from('perfiles').update({ credito: creditoRestante }).eq('id', this.userProfile.id);
      }

      this.isPaid.set(true);
      this.ticketCode = qrDataStr;
      this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDataStr)}`;
    } catch (e) {
      console.error(e);
      this.toast.show('Error procesando pago.', 'error');
    } finally {
      this.isProcessing = false;
      this.cdr.detectChanges();
    }
  }

  async downloadTicket() {
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      const element = document.getElementById('ticketToDownload');
      if (!element) return;
      
      // We take a screenshot of the element
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0f0f15', // Matches the neon background typical in this app
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const ticketName = this.ticketCode ? this.ticketCode.split('-')[0] : 'comprobante';
      pdf.save(`ticket-compra-${ticketName}.pdf`);
      
    } catch (e) {
      console.error('Error generando PDF', e);
      this.toast.show('Error al generar el comprobante PDF', 'error');
    }
  }
}
