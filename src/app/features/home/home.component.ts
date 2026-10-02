import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Movie } from '../../shared/models';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private swPush = inject(SwPush, { optional: true });

  topMovies: Movie[] = [];
  allMovies: Movie[] = [];
  upcomingMovies: Movie[] = [];
  filteredMovies: Movie[] = []; 
  heroMovie: Movie | null = null; 

  // Variables para filtros
  allGenres: string[] = [];
  selectedGenre: string = '';
  searchTerm: string = '';

  async ngOnInit() {
    try {
      this.topMovies = await this.supabaseService.getTopSellingMovies();
      this.allMovies = await this.supabaseService.getMovies();
      this.upcomingMovies = await this.supabaseService.getUpcomingMovies();
      
      // Extraer géneros únicos de las películas traídas
      const genresSet = new Set<string>();
      this.allMovies.forEach(movie => {
        if (movie.generos && Array.isArray(movie.generos)) {
          movie.generos.forEach(g => {
            if (g.nombre) genresSet.add(g.nombre);
          });
        }
      });
      this.allGenres = Array.from(genresSet).sort();
      
      this.filteredMovies = [...this.allMovies];

      if (this.allMovies.length > 0) {
        this.heroMovie = [...this.allMovies].sort((peliculaA, peliculaB) => 
          new Date(peliculaB.fecha_estreno).getTime() - new Date(peliculaA.fecha_estreno).getTime()
        )[0];
      } else if (this.topMovies.length > 0) {
        this.heroMovie = this.topMovies[0];
      }
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error cargando películas:', error);
    }
  }

  async subscribeToAlert(movie: Movie) {
    if (!this.swPush) {
      alert('Las notificaciones no están soportadas en tu navegador.');
      return;
    }
    const daysUntilRelease = this.getDaysUntil(movie.fecha_estreno);
    if (daysUntilRelease <= 7) {
      alert('¡La preventa ya está disponible o el estreno es en menos de 7 días!');
      return;
    }

    try {
      if (!movie.id) {
        throw new Error('La película no tiene un ID válido.');
      }
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey
      });
      await this.supabaseService.savePushSubscription(sub);
      await this.supabaseService.subscribeToPresaleAlert(movie.id);
      alert('¡Te suscribiste! Te avisaremos cuando empiece la preventa.');
    } catch (err) {
      console.error('No se pudo suscribir a notificaciones', err);
      alert('Hubo un error al suscribirse a las notificaciones.');
    }
  }

  isPresaleAvailable(movie: Movie): boolean {
    if (movie.precio_preventa && this.getDaysUntil(movie.fecha_estreno) <= 7) {
      return true;
    }
    return false;
  }

  getDaysUntil(dateStr: string): number {
    const today = new Date();
    const release = new Date(dateStr);
    const diff = release.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  }

  onSearch(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
    this.applyFilters();
  }

  onGenreChange(event: Event) {
    this.selectedGenre = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredMovies = this.allMovies.filter(movie => {
      // 1. Filtro por nombre
      const matchesName = movie.titulo.toLowerCase().includes(this.searchTerm);
      
      // 2. Filtro por género
      let matchesGenre = true;
      if (this.selectedGenre !== '') {
        if (movie.generos && Array.isArray(movie.generos)) {
          matchesGenre = movie.generos.some(g => g.nombre === this.selectedGenre);
        } else {
          matchesGenre = false; // Si seleccionó género pero la peli no tiene
        }
      }

      return matchesName && matchesGenre;
    });
  }
}
