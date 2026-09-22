import { Injectable, inject, signal } from '@angular/core';
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
        // Regla Discapacidad en filas J y K (espacio central vacío, "2, 10 y 2")
        // Digamos columnas: 1-4 (normal), 5-24 (espacio central, 10 asientos por lado, etc)
        // Para simplificar: Las filas J y K no tienen butacas de la col 5 a la 24.
        let isAccessible = false;
        let isSpace = false;
        if (r === 'J' || r === 'K') {
          if (c > 4 && c < 25) {
            isSpace = true; // Espacio central vacío para sillas de ruedas
          } else {
            isAccessible = true; // Las butacas restantes en J y K son accesibles
          }
        }
        
        if (!isSpace) {
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

  async reserveSeats(funcionId: string, seatsToReserve: Seat[]) {
    // Legacy method, not used anymore
  }

  async createTicket(funcionId: string, seatsToReserve: Seat[], finalPrice: number, userId?: string) {
    // 1. Insert ticket
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

    // 2. Insert seats linked to ticket
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

    return ticket.codigo_qr;
  }

  subscribeToSeatChanges(funcionId: string) {
    this.seatChannel = this.supabase.client.channel(`seats-${funcionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'butacas_ocupadas', filter: `funcion_id=eq.${funcionId}` }, 
      (payload: any) => {
        if (payload.eventType === 'INSERT') {
          this.updateSeat(payload.new.fila, payload.new.columna, 'occupied');
        } else if (payload.eventType === 'DELETE') {
          this.updateSeat(payload.old.fila, payload.old.columna, 'available');
        }
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
         current[idx].status = status;
      }
    });
    this.seats.set(current);
  }
  
  private updateSeat(row: string, col: number, status: 'occupied'|'available') {
    const current = [...this.seats()];
    const idx = current.findIndex(s => s.row === row && s.col === col);
    if (idx !== -1) {
       current[idx].status = status;
       this.seats.set(current);
    }
  }
}
