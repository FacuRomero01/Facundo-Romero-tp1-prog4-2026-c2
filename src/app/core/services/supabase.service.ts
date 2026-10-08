import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Movie, UserProfile } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // --- AUTHENTICATION ---
  get auth() {
    return this.client.auth;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signUp(email: string, password: string, profileData: any) {
    const { data, error } = await this.client.auth.signUp({ 
      email, 
      password 
    });
    if (error) throw error;
    
    // Fuerzo el inicio de sesión explícito si Supabase no nos dio la sesión automática
    const { data: sessionData } = await this.client.auth.getSession();
    if (!sessionData.session) {
       await this.client.auth.signInWithPassword({ email, password });
    }

    // Si se creó el usuario en Auth, creamos el perfil en nuestra tabla `perfiles`
    if (data.user) {
      const { error: profileError } = await this.client.from('perfiles').insert({
        id: data.user.id,
        email: email,
        ...profileData
      });
      if (profileError) throw profileError;
    }
    
    return data;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  public getArgentinaDateString(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return formatter.format(new Date());
  }

  async getMovies(): Promise<Movie[]> {
    const today = this.getArgentinaDateString();
    const { data, error } = await this.client
      .from('peliculas')
      .select('*, generos(nombre)')
      .neq('estado', 'retirada')
      .lte('fecha_estreno', today);
      
    if (error) throw error;
    return data || [];
  }

  async getMovieById(id: string): Promise<Movie | null> {
    const { data, error } = await this.client
      .from('peliculas')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
    return data;
  }

  async getAllMovies(): Promise<Movie[]> {
    const { data, error } = await this.client
      .from('peliculas')
      .select('*');
      
    if (error) throw error;
    return data || [];
  }

  async getTopSellingMovies(): Promise<Movie[]> {
    // 1. Obtener todas las butacas vendidas y su pelicula_id
    const { data: butacas, error: butacasError } = await this.client
      .from('butacas_ocupadas')
      .select('funciones(pelicula_id)');

    if (butacasError) throw butacasError;

    // 2. Contar ventas por pelicula_id
    const conteoVentas: { [peliculaId: string]: number } = {};
    butacas?.forEach((butaca: any) => {
      const peliculaId = butaca.funciones?.pelicula_id;
      if (peliculaId) {
        conteoVentas[peliculaId] = (conteoVentas[peliculaId] || 0) + 1;
      }
    });

    // 3. Ordenar y sacar los top 3 pelicula_id
    const top3Ids = Object.entries(conteoVentas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);

    if (top3Ids.length === 0) {
      // Si no hay ventas, devolver 3 peliculas por defecto
      const { data, error } = await this.client.from('peliculas').select('*').limit(3);
      if (error) throw error;
      return data || [];
    }

    // 4. Obtener los datos completos de esas películas
    const { data: peliculas, error: peliError } = await this.client
      .from('peliculas')
      .select('*')
      .in('id', top3Ids);

    if (peliError) throw peliError;

    // 5. Mantener el orden de más vendida a menos vendida
    const peliculasOrdenadas = top3Ids
      .map(peliculaId => peliculas?.find(pelicula => pelicula.id === peliculaId))
      .filter(pelicula => !!pelicula) as Movie[];
    
    return peliculasOrdenadas;
  }

  async getFunciones(peliculaId: string): Promise<any[]> {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.client
      .from('funciones')
      .select('*, salas(nombre), peliculas(titulo, precio_preventa, fecha_estreno)')
      .eq('pelicula_id', peliculaId)
      .gt('fecha_hora', nowIso)
      .order('fecha_hora', { ascending: true });
      
    if (error) throw error;
    return data || [];
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    return data;
  }
  async validateTicket(qrCode: string): Promise<any> {
    const { data: ticket, error } = await this.client
      .from('tickets')
      .select('*, funciones(peliculas(titulo, duracion_minutos), salas(nombre), fecha_hora)')
      .eq('codigo_qr', qrCode)
      .single();
    if (error || !ticket) throw new Error('Ticket no encontrado o inválido.');
    
    if (ticket.estado === 'cancelado') {
      throw new Error('Esta entrada se encuentra cancelada.');
    }
    
    const { data: butacas } = await this.client
      .from('butacas_ocupadas')
      .select('*')
      .eq('ticket_id', ticket.id);
      
    const { data: candy } = await this.client
      .from('ticket_candy')
      .select('*, candy_productos(nombre)')
      .eq('ticket_id', ticket.id);
      
    return { ticket, butacas: butacas || [], candy: candy || [] };
  }

  async markTicketUsed(ticketId: string): Promise<void> {
    const { data, error } = await this.client.from('tickets').update({ estado: 'usado' }).eq('id', ticketId).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No se pudo actualizar el ticket. Posible problema de permisos (RLS).');
  }

  async markCandyDelivered(ticketId: string): Promise<void> {
    const { data, error } = await this.client.from('ticket_candy').update({ estado: 'entregado' }).eq('ticket_id', ticketId).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No se pudo actualizar el candy. Posible problema de permisos (RLS).');
  }

  async getUpcomingMovies(): Promise<Movie[]> {
    const today = this.getArgentinaDateString();
    const { data, error } = await this.client
      .from('peliculas')
      .select('*, generos(nombre)')
      .neq('estado', 'retirada')
      .gt('fecha_estreno', today);
    if (error) throw error;
    return data || [];
  }

  async subscribeToPresaleAlert(peliculaId: string): Promise<void> {
    const session = await this.client.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) throw new Error('Usuario no logueado');

    const { error } = await this.client.from('alertas_estrenos').insert({
      usuario_id: userId,
      pelicula_id: peliculaId
    });
    if (error && error.code !== '23505') throw error; // Ignore unique constraint violation
  }

  async savePushSubscription(sub: any): Promise<void> {
    const session = await this.client.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) return;

    // Convert the PushSubscription to JSON to safely access keys
    const subJSON = typeof sub.toJSON === 'function' ? sub.toJSON() : sub;
    
    const { error } = await this.client.from('push_subscriptions').upsert({
      usuario_id: userId,
      endpoint: subJSON.endpoint,
      p256dh: subJSON.keys?.p256dh || '',
      auth: subJSON.keys?.auth || ''
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  }
}

