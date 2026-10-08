import { Injectable, inject, signal, NgZone, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConfiguracionPuntos } from '../../shared/models';

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
  pointsCost: number;
  canjeActivo: boolean;
  imageUrl: string;
  quantity: number; // Pagados con dinero
  quantityPoints: number; // Pagados con puntos
}

export interface CheckoutPayload {
  funcionId: string;
  seatsToReserve: Seat[];
  finalPrice: number;
  puntosGastados: number;
  userId?: string;
  comboId?: string;
  entradasDinero: number;
  entradasPuntos: number;
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
  activePointsConfig = signal<ConfiguracionPuntos | null>(null);
  userProfile = signal<any>(null);
  maxSeats: number = 0;

  puntosUsadosEnEntradas = signal<number>(0);
  
  // Ojo: Esto asume que CandyItem ya tiene quantityPoints y pointsCost definidos en la interfaz
  candyPointsSpent = computed(() => 
    this.candyItems().reduce((acc, item) => acc + (item.quantityPoints * (item.pointsCost || 0)), 0)
  );

  puntosDisponibles = computed(() => {
    const totalPuntos = this.userProfile()?.puntos || 0;
    return totalPuntos - this.puntosUsadosEnEntradas() - this.candyPointsSpent();
  });

  // Configuración de la sala según requerimientos (20 filas x 28 columnas reales)
  readonly rows = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

  async loadPointsConfig() {
    const { data } = await this.supabase.client
      .from('configuracion_puntos')
      .select('*')
      .eq('activa', true)
      .single();
    if (data) {
      this.activePointsConfig.set(data);
    }
  }

  generateSeatMap() {
    const newSeats: Seat[] = [];
    for (let letraFila of this.rows) {
      // Regla VIP
      const isVip = ['R', 'S', 'T'].includes(letraFila);
      const multiplicadorPrecio = isVip ? 1.5 : 1.0;
      const isAccessible = (letraFila === 'J');
      const columnas = isAccessible ? 14 : 28;
      
      for (let numeroColumna = 1; numeroColumna <= columnas; numeroColumna++) {
        
        newSeats.push({
          id: `${letraFila}-${numeroColumna}`,
          row: letraFila,
          col: numeroColumna,
          status: 'available',
          type: isAccessible ? 'accessible' : (isVip ? 'vip' : 'regular'),
          priceMultiplier: multiplicadorPrecio
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

  async createTicket(payload: CheckoutPayload) {
    const { funcionId, seatsToReserve, finalPrice, puntosGastados, userId, comboId, entradasDinero, entradasPuntos } = payload;
    
    // Generar un código corto y amigable (ej. ABCD-1234)
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomNums = Math.floor(1000 + Math.random() * 9000);
    const qrData = `${randomChars}-${randomNums}`;
    
    const config = this.activePointsConfig();
    let puntosGanados = 0;
    
    if (config && finalPrice > 0) {
      puntosGanados = Math.floor(finalPrice / config.monto_dinero) * config.puntos_otorgados;
    }

    const ticketId = crypto.randomUUID();

    // Inserto el ticket
    const { error: ticketError } = await this.supabase.client
      .from('tickets')
      .insert({
        id: ticketId,
        funcion_id: funcionId,
        usuario_id: userId || null,
        codigo_qr: qrData,
        precio_final: finalPrice,
        estado: 'valido',
        puntos_ganados: puntosGanados,
        puntos_gastados: puntosGastados,
        entradas_pagadas_dinero: entradasDinero,
        entradas_pagadas_puntos: entradasPuntos,
        combo_id: comboId || null
      });

    if (ticketError) throw ticketError;

    // Inserto los asientos relacionados al ticket
    if (seatsToReserve.length > 0) {
      const inserts = seatsToReserve.map(asiento => ({
        funcion_id: funcionId,
        ticket_id: ticketId,
        fila: asiento.row,
        columna: asiento.col
      }));
      const { error: seatsError } = await this.supabase.client
        .from('butacas_ocupadas')
        .insert(inserts);
        
      if (seatsError) throw seatsError;
    }

    // Inserto el candy asociado al ticket
    const candyInserts: any[] = [];
    if (!comboId) {
      this.candyItems().forEach(itemCandy => {
        if (itemCandy.quantity > 0) {
          candyInserts.push({
            ticket_id: ticketId,
            producto_id: itemCandy.id,
            cantidad: itemCandy.quantity,
            metodo_pago: 'dinero'
          });
        }
        if (itemCandy.quantityPoints > 0) {
          candyInserts.push({
            ticket_id: ticketId,
            producto_id: itemCandy.id,
            cantidad: itemCandy.quantityPoints,
            metodo_pago: 'puntos'
          });
        }
      });
    } else {
      // Si es combo, recuperamos los productos y los insertamos
      const { data: comboItems } = await this.supabase.client
        .from('combo_candy_productos')
        .select('candy_producto_id, cantidad')
        .eq('combo_id', comboId);
        
      if (comboItems && comboItems.length > 0) {
        comboItems.forEach((ci: any) => {
          candyInserts.push({
            ticket_id: ticketId,
            producto_id: ci.candy_producto_id,
            cantidad: ci.cantidad,
            metodo_pago: 'dinero'
          });
        });
      }
    }
    
    if (candyInserts.length > 0) {
      try {
        const { error: candyError } = await this.supabase.client
          .from('ticket_candy')
          .insert(candyInserts);
        if (candyError) console.warn('Error candy:', candyError);
      } catch (err) {
        console.warn('Error al intentar guardar el Candy Bar:', err);
      }
    }

    // Lógica de Puntos (Historial y Perfil)
    if (userId && (puntosGanados > 0 || puntosGastados > 0)) {
      // 1. Insertar historial
      const { error: historialError } = await this.supabase.client
        .from('historial_puntos')
        .insert({
          usuario_id: userId,
          ticket_id: ticketId,
          puntos_ganados: puntosGanados,
          puntos_gastados: puntosGastados,
          motivo: comboId ? 'Compra de Combo' : 'Compra de Entradas/Candy',
          snapshot_monto_dinero: config?.monto_dinero || null,
          snapshot_puntos_otorgados: config?.puntos_otorgados || null
        });

      if (!historialError) {
        // 2. Actualizar saldo del usuario
        // Obtenemos el saldo actual primero
        const { data: perfilData } = await this.supabase.client
          .from('perfiles')
          .select('puntos')
          .eq('id', userId)
          .single();
          
        if (perfilData) {
          const nuevoSaldo = (perfilData.puntos || 0) + puntosGanados - puntosGastados;
          await this.supabase.client
            .from('perfiles')
            .update({ puntos: nuevoSaldo })
            .eq('id', userId);
        }
      }
    }

    return qrData;
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
    this.seats.update(seats => 
      seats.map(seat => 
        occupied.some(occupiedSeat => occupiedSeat.fila === seat.row && occupiedSeat.columna === seat.col) 
          ? { ...seat, status } 
          : seat
      )
    );
  }
  
  private updateSeat(row: string, col: number, status: 'occupied'|'available') {
    this.seats.update(seats => 
      seats.map(seat => (seat.row === row && seat.col === col) ? { ...seat, status } : seat)
    );
  }

  async loadCandyItems() {
    const { data } = await this.supabase.client.from('candy_productos').select('*').eq('activo', true);
    if (data && data.length > 0) {
      const items = data.map(datosCandy => ({
        id: datosCandy.id,
        name: datosCandy.nombre || 'Producto',
        description: datosCandy.categoria || (datosCandy.es_combo ? 'Combo' : 'Snack'),
        price: datosCandy.precio || 0,
        pointsCost: datosCandy.costo_puntos || 0,
        canjeActivo: datosCandy.activo_canje || false,
        imageUrl: datosCandy.imagen_url || datosCandy.icono || '🍿',
        quantity: 0,
        quantityPoints: 0
      }));
      this.candyItems.set(items);
    }
  }
}
