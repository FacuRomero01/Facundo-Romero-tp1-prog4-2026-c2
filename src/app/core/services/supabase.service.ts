import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Movie, UserProfile } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private _supabase: SupabaseClient;

  constructor() {
    this._supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }
  
  get client() {
    return this._supabase;
  }

  // --- AUTHENTICATION ---
  get auth() {
    return this._supabase.auth;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this._supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signUp(email: string, password: string, profileData: any) {
    const { data, error } = await this._supabase.auth.signUp({ 
      email, 
      password 
    });
    if (error) throw error;
    
    // Forzamos el inicio de sesión explícito si Supabase no nos dio la sesión automática
    // (a veces pasa por temas de caché o si quedó alguna configuración colgada en Supabase)
    const { data: sessionData } = await this._supabase.auth.getSession();
    if (!sessionData.session) {
       await this._supabase.auth.signInWithPassword({ email, password });
    }

    // Si se creó el usuario en Auth, creamos el perfil en nuestra tabla `perfiles`
    if (data.user) {
      const { error: profileError } = await this._supabase.from('perfiles').insert({
        id: data.user.id,
        email: email,
        ...profileData
      });
      if (profileError) throw profileError;
    }
    
    return data;
  }

  async signOut() {
    const { error } = await this._supabase.auth.signOut();
    if (error) throw error;
  }

  // --- MOVIES ---
  async getMovies(): Promise<Movie[]> {
    const { data, error } = await this._supabase
      .from('peliculas')
      .select('*')
      .eq('estado', 'cartelera');
      
    if (error) throw error;
    return data || [];
  }

  async getAllMovies(): Promise<Movie[]> {
    const { data, error } = await this._supabase
      .from('peliculas')
      .select('*');
      
    if (error) throw error;
    return data || [];
  }

  async getTopSellingMovies(): Promise<Movie[]> {
    // Aquí implementaremos la lógica del top 3 de ventas
    const { data, error } = await this._supabase
      .from('peliculas')
      .select('*')
      .limit(3);
      
    if (error) throw error;
    return data || [];
  }

  async getFunciones(peliculaId: string): Promise<any[]> {
    const { data, error } = await this._supabase
      .from('funciones')
      .select('*, salas(nombre)')
      .eq('pelicula_id', peliculaId)
      .order('fecha_hora', { ascending: true });
      
    if (error) throw error;
    return data || [];
  }

  // --- USER PROFILES ---
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this._supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    return data;
  }
}
