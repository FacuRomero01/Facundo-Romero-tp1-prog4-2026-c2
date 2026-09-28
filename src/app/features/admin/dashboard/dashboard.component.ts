import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Movie } from '../../../shared/models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  movies: Movie[] = [];
  generosDisponibles: any[] = [];
  showMovieForm = false;
  newMovie: Partial<Movie> & { genero_ids?: string[] } = this.getEmptyMovie();
  
  private getEmptyMovie(): Partial<Movie> & { genero_ids?: string[] } {
    return {
      titulo: '',
      sinopsis: '',
      duracion_minutos: 120,
      imagen_url: '',
      restriccion_edad: 'ATP',
      estado: 'cartelera',
      fecha_estreno: new Date().toISOString().split('T')[0],
      genero_ids: []
    };
  }
  
  // KPIs
  ingresosMensuales = 0;
  entradasVendidas = 0;
  combosVendidos = 0;

  async ngOnInit() {
    try {
      this.movies = await this.supabase.getAllMovies();
      
      // Calcular KPIs y cargar géneros
      const [tickets, butacas, combos, generos] = await Promise.all([
        this.supabase.client.from('tickets').select('precio_final'),
        this.supabase.client.from('butacas_ocupadas').select('*', { count: 'exact', head: true }),
        this.supabase.client.from('ticket_candy').select('cantidad'),
        this.supabase.client.from('generos').select('*')
      ]);

      this.ingresosMensuales = tickets.data?.reduce((acc, t) => acc + (t.precio_final || 0), 0) || 0;
      this.entradasVendidas = butacas.count || 0;
      this.combosVendidos = combos.data?.reduce((acc, c) => acc + (c.cantidad || 0), 0) || 0;
      this.generosDisponibles = generos.data || [];

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error cargando datos del dashboard:', e);
      this.movies = [];
      this.cdr.detectChanges();
    }
  }

  // Métodos para ABM de películas
  async abrirFormulario(movie?: Movie) {
    if (movie) {
      this.newMovie = { ...movie, genero_ids: [] };
      // Cargar géneros de esta película
      const { data } = await this.supabase.client
        .from('peliculas_generos')
        .select('genero_id')
        .eq('pelicula_id', movie.id);
      this.newMovie.genero_ids = data?.map(d => d.genero_id) || [];
    } else {
      this.newMovie = this.getEmptyMovie();
    }
    this.showMovieForm = true;
  }

  cerrarFormulario() {
    this.showMovieForm = false;
  }

  async guardarPelicula() {
    if (!this.newMovie.titulo || !this.newMovie.duracion_minutos || !this.newMovie.fecha_estreno) {
      alert('Por favor completá los campos obligatorios.');
      return;
    }
    
    try {
      let data, error;
      const peliculaData = { ...this.newMovie };
      delete peliculaData.genero_ids; // No existe en la tabla peliculas
      
      if (this.newMovie.id) {
        // Actualizar película existente
        const response = await this.supabase.client
          .from('peliculas')
          .update(peliculaData)
          .eq('id', this.newMovie.id)
          .select()
          .single();
        data = response.data;
        error = response.error;
      } else {
        // Insertar nueva película
        const response = await this.supabase.client
          .from('peliculas')
          .insert(peliculaData)
          .select()
          .single();
        data = response.data;
        error = response.error;
      }
        
      if (error) throw error;
      
      if (data) {
        // Guardar relaciones de géneros
        const movieId = data.id;
        
        // Primero borrar anteriores si es actualización
        if (this.newMovie.id) {
          await this.supabase.client.from('peliculas_generos').delete().eq('pelicula_id', movieId);
        }
        
        // Insertar los nuevos seleccionados
        if (this.newMovie.genero_ids && this.newMovie.genero_ids.length > 0) {
          const genreInserts = this.newMovie.genero_ids.map(gId => ({
            pelicula_id: movieId,
            genero_id: gId
          }));
          await this.supabase.client.from('peliculas_generos').insert(genreInserts);
        }

        if (this.newMovie.id) {
          const index = this.movies.findIndex(m => m.id === this.newMovie.id);
          if (index !== -1) {
            this.movies[index] = data;
          }
          alert('Película y sus géneros actualizados correctamente.');
        } else {
          this.movies = [...this.movies, data];
          alert('Película y sus géneros guardados correctamente.');
        }
        
        this.cerrarFormulario();
        this.cdr.detectChanges();
      }
    } catch (e: any) {
      console.error('Error al guardar película:', e);
      alert('Ocurrió un error al guardar la película: ' + e.message);
    }
  }

  editarPelicula(movie: Movie) {
    this.abrirFormulario(movie);
  }

  async cambiarEstado(movie: Movie) {
    const estados: ('cartelera' | 'proximamente')[] = ['proximamente', 'cartelera'];
    const currentIndex = estados.indexOf(movie.estado as any);
    const nextEstado = estados[(currentIndex + 1) % estados.length] || 'cartelera';
    
    if (confirm(`¿Cambiar el estado de "${movie.titulo}" a "${nextEstado}"?`)) {
      try {
        const { data, error } = await this.supabase.client
          .from('peliculas')
          .update({ estado: nextEstado })
          .eq('id', movie.id)
          .select()
          .single();
          
        if (error) throw error;
        
        if (data) {
          const index = this.movies.findIndex(m => m.id === movie.id);
          if (index !== -1) {
            this.movies[index] = data;
          }
          this.cdr.detectChanges();
        }
      } catch (e: any) {
        console.error('Error al cambiar estado:', e);
        alert('Ocurrió un error al cambiar el estado: ' + e.message);
      }
    }
  }
}
