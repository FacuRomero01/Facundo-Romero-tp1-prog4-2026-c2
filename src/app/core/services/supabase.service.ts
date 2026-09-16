import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Movie, UserProfile } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // --- AUTHENTICATION ---
  get auth() {
    return this.supabase.auth;
  }

  // --- MOVIES ---
  async getMovies(): Promise<Movie[]> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('estado', 'cartelera');
      
    if (error) throw error;
    return data || [];
  }

  async getTopSellingMovies(): Promise<Movie[]> {
    // Aquí implementaremos la lógica del top 3 de ventas
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .limit(3);
      
    if (error) throw error;
    return data || [];
  }

  // --- USER PROFILES ---
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    return data;
  }
}
