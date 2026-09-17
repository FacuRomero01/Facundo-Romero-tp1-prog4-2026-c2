import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Movie } from '../../../shared/models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  movies: Movie[] = [];
  
  // Datos simulados para el reporte
  ingresosMensuales = 1542000;
  entradasVendidas = 342;
  combosVendidos = 120;

  async ngOnInit() {
    try {
      this.movies = await this.supabase.getAllMovies();
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error cargando películas:', e);
      this.movies = [
        { id: '1', titulo: 'Spider-Man 4', sinopsis: 'Acción', duracion_minutos: 120, imagen_url: 'assets/poster-spiderman.jpg', restriccion_edad: 'ATP', estado: 'cartelera', fecha_estreno: '2026-01-01' },
        { id: '2', titulo: 'Inception 2', sinopsis: 'Ciencia ficción', duracion_minutos: 148, imagen_url: 'assets/poster-inception.jpg', restriccion_edad: '+13', estado: 'proximamente', fecha_estreno: '2026-11-01' }
      ];
      this.cdr.detectChanges();
    }
  }

  // Métodos mock para interacción
  editarPelicula(movie: Movie) {
    alert(`Editando película: ${movie.titulo}`);
  }

  cambiarEstado(movie: Movie) {
    alert(`Cambiando estado de ${movie.titulo}... (Mock)`);
  }
}
