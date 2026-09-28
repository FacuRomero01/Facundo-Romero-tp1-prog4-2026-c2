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
  filteredMovies: Movie[] = []; // Nueva variable para mostrar las filtradas
  heroMovie: Movie | null = null; // Pelicula destacada en el hero

  async ngOnInit() {
    try {
      this.topMovies = await this.supabaseService.getTopSellingMovies();
      this.allMovies = await this.supabaseService.getMovies();
      
      // Al inicio, las películas filtradas son todas
      this.filteredMovies = [...this.allMovies];

      // El hero será el último estreno (la fecha más reciente)
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
      const mockMovie: Movie = {
        id: '1', titulo: 'Spider-Man 4', sinopsis: 'Acción', 
        duracion_minutos: 120, imagen_url: '', restriccion_edad: 'ATP', 
        estado: 'cartelera', fecha_estreno: '2026-01-01'
      };
      this.topMovies = [mockMovie, {...mockMovie, id: '2', titulo: 'Inception 2'}];
      this.allMovies = this.topMovies;
      this.filteredMovies = [...this.allMovies];
      this.heroMovie = this.allMovies[0];
      this.cdr.detectChanges();
    }
  }

  onSearch(event: Event) {
    const searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
    
    // Filtramos la lista original (allMovies) buscando coincidencias en el título
    this.filteredMovies = this.allMovies.filter(movie => 
      movie.titulo.toLowerCase().includes(searchTerm)
    );
  }
}
