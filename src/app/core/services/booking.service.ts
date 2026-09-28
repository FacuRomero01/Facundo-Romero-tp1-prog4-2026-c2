import { Injectable, inject, signal, NgZone } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Seat {
  id: string; // Ej: A-1
  row: string;
  col: number;
  status: 'available' | 'occupied' | 'selected' | 'disabled';
  type: 'regular' | 'accessible' | 'vip';
  priceMultiplier: number;
}

export interface CandyItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private supabase = inject(SupabaseService);
  private ngZone = inject(NgZone);
  private seatChannel!: RealtimeChannel;
  
  // Usamos signals para que Angular actualice la vista de las butacas automáticamente
  seats = signal<Seat[]>([]);
  candyItems = signal<CandyItem[]>([]);
  selectedFuncion = signal<any>(null); // Añadido para el pago


  // Configuración de la sala según requerimientos (20 filas x 28 columnas reales)
  readonly rows = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

  
  generateSeatMap() {
    const newSeats: Seat[] = [];
    for (let r of this.rows) {
      // Regla VIP
      const isVip = ['R', 'S', 'T'].includes(r);
      const mult = isVip ? 1.5 : 1.0;
      
      for (let c = 1; c <= 28; c++) {
        let isAccessible = (r === 'J');
        
        newSeats.push({
          id: `${r}-${c}`,
          row: r,
          col: c,
          status: 'available',
          type: isAccessible ? 'accessible' : (isVip ? 'vip' : 'regular'),
          priceMultiplier: mult
        });
      }
    }
    this.seats.set(newSeats);
  }

  async loadOccupiedSeats(funcionId: string) {
    const { data } = await this.supabase.client // workaround
      .from('butacas_ocupadas')
      .select('fila, columna')
      .eq('funcion_id', funcionId);
      
    if (data) {
      this.updateSeatsStatus(data, 'occupied');
    }
  }

  async createTicket(funcionId: string, seatsToReserve: Seat[], finalPrice: number, userId?: string) {
    // Inserto el ticket
    const qrData = `TICKET-${funcionId}-${Date.now()}`;
    const { data: ticket, error: ticketError } = await this.supabase.client
      .from('tickets')
      .insert({
        funcion_id: funcionId,
        usuario_id: userId || null,
        codigo_qr: qrData,
        precio_final: finalPrice,
        estado: 'valido'
      })
      .select('id, codigo_qr')
      .single();

    if (ticketError) throw ticketError;

    // Inserto los asientos relacionados al ticket
    if (seatsToReserve.length > 0) {
      const inserts = seatsToReserve.map(s => ({
        funcion_id: funcionId,
        ticket_id: ticket.id,
        fila: s.row,
        columna: s.col
      }));
      const { error: seatsError } = await this.supabase.client
        .from('butacas_ocupadas')
        .insert(inserts);
        
      if (seatsError) throw seatsError;
    }

    // Inserto el candy asociado al ticket
    const candy = this.candyItems().filter(c => c.quantity > 0);
    if (candy.length > 0) {
      const candyInserts = candy.map(c => ({
        ticket_id: ticket.id,
        producto_id: c.id,
        cantidad: c.quantity
      }));
      try {
        const { error: candyError } = await this.supabase.client
          .from('ticket_candy')
          .insert(candyInserts);
      } catch (err) {
        console.warn('Error al intentar guardar el Candy Bar:', err);
      }
    }

    return ticket.codigo_qr;
  }

  subscribeToSeatChanges(funcionId: string) {
    this.seatChannel = this.supabase.client.channel(`seats-${funcionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'butacas_ocupadas', filter: `funcion_id=eq.${funcionId}` }, 
      (payload: any) => {
        this.ngZone.run(() => {
          if (payload.eventType === 'INSERT') {
            this.updateSeat(payload.new.fila, payload.new.columna, 'occupied');
          } else if (payload.eventType === 'DELETE') {
            this.updateSeat(payload.old.fila, payload.old.columna, 'available');
          }
        });
      }).subscribe();
  }
  
  unsubscribe() {
    if (this.seatChannel) {
      this.seatChannel.unsubscribe();
    }
  }

  private updateSeatsStatus(occupied: {fila: string, columna: number}[], status: 'occupied'|'available') {
    const current = [...this.seats()];
    occupied.forEach(o => {
      const idx = current.findIndex(s => s.row === o.fila && s.col === o.columna);
      if (idx !== -1) {
         current[idx] = { ...current[idx], status };
      }
    });
    this.seats.set(current);
  }
  
  private updateSeat(row: string, col: number, status: 'occupied'|'available') {
    const current = [...this.seats()];
    const idx = current.findIndex(s => s.row === row && s.col === col);
    if (idx !== -1) {
       current[idx] = { ...current[idx], status };
       this.seats.set(current);
    }
  }

  async loadCandyItems() {
    const { data } = await this.supabase.client.from('candy_productos').select('*');
    if (data && data.length > 0) {
      const items = data.map(d => ({
        id: d.id,
        name: d.nombre || 'Producto',
        description: d.categoria || (d.es_combo ? 'Combo' : 'Snack'),
        price: d.precio || 0,
        imageUrl: d.imagen_url || d.icono || '🍿',
        quantity: 0
      }));
      this.candyItems.set(items);
    }
  }
}
