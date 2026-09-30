import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Movie } from '../../shared/models';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  topMovies: Movie[] = [];
  allMovies: Movie[] = [];
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
