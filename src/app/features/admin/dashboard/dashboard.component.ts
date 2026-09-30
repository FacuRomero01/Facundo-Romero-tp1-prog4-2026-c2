import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Movie } from '../../../shared/models';
import { SpanishDatePipe } from '../../../shared/pipes/spanish-date.pipe';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, FormsModule, SpanishDatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  
  currentTab = 'peliculas'; // peliculas, funciones, reportes
  
  // Películas
  movies: Movie[] = [];
  generosDisponibles: any[] = [];
  showMovieForm = false;
  newMovie: Partial<Movie> & { genero_ids?: string[] } = this.getEmptyMovie();
  
  // Funciones
  funciones: any[] = [];
  showFuncionForm = false;
  newFuncion: any = this.getEmptyFuncion();

  // Logs
  logs: any[] = [];

  private getEmptyMovie(): Partial<Movie> & { genero_ids?: string[] } {
    return {
      titulo: '',
      sinopsis: '',
      duracion_minutos: 120,
      imagen_url: '',
      restriccion_edad: 'ATP',
      estado: 'cartelera',
      fecha_estreno: new Date().toISOString().split('T')[0],
      precio_preventa: 4000,
      genero_ids: []
    };
  }

  private getEmptyFuncion() {
    return {
      pelicula_id: '',
      fecha_hora: new Date().toISOString().slice(0,16),
      formato: '2D',
      idioma: 'Castellano',
      precio_base: 4500
    };
  }
  
  // KPIs
  ingresosMensuales = 0;
  entradasVendidas = 0;
  combosVendidos = 0;

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.movies = await this.supabase.getAllMovies();
      
      const [tickets, butacas, combos, generos, funcionesData, logsData] = await Promise.all([
        this.supabase.client.from('tickets').select('precio_final'),
        this.supabase.client.from('butacas_ocupadas').select('*', { count: 'exact', head: true }),
        this.supabase.client.from('ticket_candy').select('cantidad'),
        this.supabase.client.from('generos').select('*'),
        this.supabase.client.from('funciones').select('*, peliculas(titulo), salas(nombre)').order('fecha_hora', { ascending: false }),
        this.supabase.client.from('log_actividad').select('*, perfiles(nombre, apellido, email)').order('fecha', { ascending: false }).limit(50)
      ]);

      this.ingresosMensuales = tickets.data?.reduce((acc, t) => acc + (t.precio_final || 0), 0) || 0;
      this.entradasVendidas = butacas.count || 0;
      this.combosVendidos = combos.data?.reduce((acc, c) => acc + (c.cantidad || 0), 0) || 0;
      this.generosDisponibles = generos.data || [];
      this.funciones = funcionesData.data || [];
      this.logs = logsData.data || [];

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error cargando datos del dashboard:', e);
      this.cdr.detectChanges();
    }
  }

  setTab(tab: string) {
    this.currentTab = tab;
  }

  // Métodos ABM Películas (Omitted unchanged code, simplified for size)
  async abrirFormulario(movie?: Movie) {
    if (movie) {
      this.newMovie = { ...movie, genero_ids: [] };
      const { data } = await this.supabase.client.from('peliculas_generos').select('genero_id').eq('pelicula_id', movie.id);
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
    if (!this.newMovie.titulo) return;
    try {
      const peliculaData = { ...this.newMovie };
      delete peliculaData.genero_ids;
      const { data, error } = this.newMovie.id 
        ? await this.supabase.client.from('peliculas').update(peliculaData).eq('id', this.newMovie.id).select().single()
        : await this.supabase.client.from('peliculas').insert(peliculaData).select().single();
        
      if (error) throw error;
      if (data) {
        if (this.newMovie.id) {
          await this.supabase.client.from('peliculas_generos').delete().eq('pelicula_id', data.id);
        }
        if (this.newMovie.genero_ids && this.newMovie.genero_ids.length > 0) {
          const genreInserts = this.newMovie.genero_ids.map(gId => ({ pelicula_id: data.id, genero_id: gId }));
          await this.supabase.client.from('peliculas_generos').insert(genreInserts);
        }
        
        await this.logAction(this.newMovie.id ? `Modificó la película: ${data.titulo}` : `Creó la película: ${data.titulo}`);
        alert('Película guardada.');
        this.cerrarFormulario();
        await this.loadData();
      }
    } catch (e: any) { alert('Error: ' + e.message); }
  }

  editarPelicula(movie: Movie) { this.abrirFormulario(movie); }
  
  async cambiarEstado(movie: Movie) {
    const estados: ('cartelera' | 'proximamente')[] = ['proximamente', 'cartelera'];
    const nextEstado = estados[(estados.indexOf(movie.estado as any) + 1) % estados.length] || 'cartelera';
    if (confirm(`¿Cambiar estado a "${nextEstado}"?`)) {
      await this.supabase.client.from('peliculas').update({ estado: nextEstado }).eq('id', movie.id);
      await this.loadData();
    }
  }

  // Funciones ABM
  abrirFormularioFuncion() {
    this.newFuncion = this.getEmptyFuncion();
    if (this.movies.length > 0) this.newFuncion.pelicula_id = this.movies[0].id;
    this.showFuncionForm = true;
  }

  cerrarFormularioFuncion() { this.showFuncionForm = false; }

  async guardarFuncion() {
    try {
      const { data, error } = await this.supabase.client.from('funciones').insert(this.newFuncion).select().single();
      if (error) throw error;
      
      const peli = this.movies.find(m => m.id === this.newFuncion.pelicula_id);
      await this.logAction(`Creó una función para ${peli?.titulo} el ${this.newFuncion.fecha_hora}`);
      
      alert('Función guardada y sala asignada automáticamente.');
      this.cerrarFormularioFuncion();
      await this.loadData();
    } catch(e: any) {
      alert('Error (probablemente solapamiento de horarios o falta de sala disponible): ' + e.message);
    }
  }

  // Logs
  async logAction(accion: string) {
    const session = await this.supabase.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    if (userId) {
      const { error } = await this.supabase.client.from('log_actividad').insert({ usuario_id: userId, accion });
      if (error) {
        console.error('Error guardando log de actividad:', error);
      }
    }
  }

  // Reportes
  exportCSV() {
    let csv = 'Fecha,Total Facturado,Entradas Vendidas\n';
    csv += `${new Date().toLocaleDateString()},${this.ingresosMensuales},${this.entradasVendidas}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_facturacion.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    this.logAction('Exportó reporte a Excel/CSV');
  }

  exportPDF() {
    window.print();
    this.logAction('Exportó reporte a PDF (Impresión)');
  }
}

