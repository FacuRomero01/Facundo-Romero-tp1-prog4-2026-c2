import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Movie } from '../../../shared/models';
import { SpanishDatePipe } from '../../../shared/pipes/spanish-date.pipe';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, FormsModule, SpanishDatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  
  currentTab = 'peliculas'; // peliculas, funciones, reportes

  allMoviesLight: any[] = [];
  moviesPage = 1;
  moviesPageSize = 5;
  moviesTotal = 0;
  moviesSearch = '';
  moviesSearchSubject = new Subject<string>();

  funcionesPage = 1;
  funcionesPageSize = 10;
  funcionesTotal = 0;
  fFuncionPeliculaId = '';
  fFuncionFecha = '';
  funcionesSearchSubject = new Subject<void>();
  
  // Películas
  movies: Movie[] = [];
  generosDisponibles: any[] = [];
  showMovieForm = false;
  newMovie: Partial<Movie> & { genero_ids?: string[] } = this.getEmptyMovie();
  
  // Funciones
  funciones: any[] = [];
  showFuncionForm = false;
  newFuncion: any = this.getEmptyFuncion();

  
  // Cupones
  cupones: any[] = [];
  showCuponForm = false;
  newCupon: any = { codigo: '', porcentaje_descuento: 20, activo: true, tipo_restriccion: 'ninguna' };

  // Candy Bar
  candyProductos: any[] = [];
  showCandyForm = false;
  newCandy: any = { nombre: '', categoria: 'Snacks', precio: 1000, imagen_url: '', es_combo: false, costo_puntos: 100, activo_canje: true, activo: true };

  // Combos
  combos: any[] = [];
  showComboForm = false;
  newCombo: any = { titulo: '', descripcion: '', precio: 5000, entradas_incluidas: 2, activo: true, productos_incluidos: [] };

  // Fidelizacion
  configPuntos: any = { id: '', monto_dinero: 100, puntos_otorgados: 1, activa: true };

  // Analytics
  facturacionPorDia: { fecha: string, total: number, entradas: number, candy: number }[] = [];
  peliculasMasVistas: { titulo: string, vistas: number }[] = [];
  candyMasVendido: { nombre: string, cantidad: number }[] = [];

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
    this.moviesSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.moviesPage = 1;
      this.loadMoviesPaginated();
    });

    this.funcionesSearchSubject.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.funcionesPage = 1;
      this.loadFuncionesPaginated();
    });

    const session = await this.supabase.auth.getSession();
    if (!session?.data?.session) {
      this.router.navigate(['/auth/login']);
      return;
    }
    const profile = await this.supabase.getProfile(session.data.session.user.id);
    if (profile?.rol !== 'admin') {
      this.router.navigate(['/']);
      return;
    }
    await this.loadData();
  }

  async loadData() {
    try {
      const { data: moviesLight } = await this.supabase.client.from('peliculas').select('id, titulo').order('titulo');
      this.allMoviesLight = moviesLight || [];
      
      await this.loadMoviesPaginated();
      await this.loadFuncionesPaginated();

      const [
        tickets, 
        butacas, 
        combosData, 
        generos, 
        logsData,
        cuponesData,
        candyData,
        configPuntosData,
        ticketCandyData
      ] = await Promise.all([
        this.supabase.client.from('tickets').select('precio_final, funciones(fecha_hora, peliculas(titulo))'),
        this.supabase.client.from('butacas_ocupadas').select('*', { count: 'exact', head: true }),
        this.supabase.client.from('combos').select('*, combo_candy_productos(cantidad, candy_producto_id, candy_productos(nombre))'),
        this.supabase.client.from('generos').select('*'),
        this.supabase.client.from('log_actividad').select('*, perfiles(nombre, apellido, email)').order('fecha', { ascending: false }).limit(50),
        this.supabase.client.from('cupones').select('*').order('id', { ascending: false }),
        this.supabase.client.from('candy_productos').select('*').order('nombre'),
        this.supabase.client.from('configuracion_puntos').select('*').limit(1).maybeSingle(),
        this.supabase.client.from('ticket_candy').select('cantidad, candy_productos(nombre)')
      ]);

      this.cupones = cuponesData.data || [];
      this.candyProductos = candyData.data || [];
      this.combos = combosData.data || [];
      if (configPuntosData.data) this.configPuntos = configPuntosData.data;

      this.ingresosMensuales = tickets.data?.reduce((acc, t) => acc + (t.precio_final || 0), 0) || 0;
      this.entradasVendidas = butacas.count || 0;
      this.combosVendidos = ticketCandyData.data?.reduce((acc, c) => acc + (c.cantidad || 0), 0) || 0;
      this.generosDisponibles = generos.data || [];
      this.logs = logsData.data || [];

      // Calculate charts
      const facturacionMap = new Map<string, number>();
      const peliculasMap = new Map<string, number>();
      
      tickets.data?.forEach((t: any) => {
        const d = new Date(t.funciones?.fecha_hora || new Date()).toLocaleDateString('es-AR');
        facturacionMap.set(d, (facturacionMap.get(d) || 0) + (t.precio_final || 0));
        
        const titulo = t.funciones?.peliculas?.titulo;
        if (titulo) peliculasMap.set(titulo, (peliculasMap.get(titulo) || 0) + 1);
      });
      
      this.facturacionPorDia = Array.from(facturacionMap.entries()).map(([fecha, total]) => ({ fecha, total, entradas: 0, candy: 0 })).slice(0, 7);
      this.peliculasMasVistas = Array.from(peliculasMap.entries()).map(([titulo, vistas]) => ({ titulo, vistas })).sort((a,b)=>b.vistas - a.vistas).slice(0, 5);

      const candyMap = new Map<string, number>();
      ticketCandyData.data?.forEach((c: any) => {
        const nombre = c.candy_productos?.nombre;
        if (nombre) candyMap.set(nombre, (candyMap.get(nombre) || 0) + c.cantidad);
      });
      this.candyMasVendido = Array.from(candyMap.entries()).map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a,b)=>b.cantidad - a.cantidad).slice(0, 5);

      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error cargando datos del dashboard:', e);
      this.cdr.detectChanges();
    }
  }

  async loadMoviesPaginated() {
    let query = this.supabase.client.from('peliculas').select('*', { count: 'exact' });
    if (this.moviesSearch) {
      query = query.ilike('titulo', `%${this.moviesSearch}%`);
    }
    const from = (this.moviesPage - 1) * this.moviesPageSize;
    const to = from + this.moviesPageSize - 1;
    const { data, count, error } = await query.order('fecha_estreno', { ascending: false }).range(from, to);
    if (!error) {
      this.movies = data || [];
      this.moviesTotal = count || 0;
      this.cdr.detectChanges();
    }
  }

  async loadFuncionesPaginated() {
    let query = this.supabase.client.from('funciones').select('*, peliculas!inner(titulo), salas!inner(nombre)', { count: 'exact' });
    if (this.fFuncionPeliculaId) {
      query = query.eq('pelicula_id', this.fFuncionPeliculaId);
    }
    if (this.fFuncionFecha) {
      query = query.gte('fecha_hora', `${this.fFuncionFecha}T00:00:00`).lte('fecha_hora', `${this.fFuncionFecha}T23:59:59`);
    }
    const from = (this.funcionesPage - 1) * this.funcionesPageSize;
    const to = from + this.funcionesPageSize - 1;
    const { data, count, error } = await query.order('fecha_hora', { ascending: false }).range(from, to);
    if (!error) {
      this.funciones = data || [];
      this.funcionesTotal = count || 0;
      this.cdr.detectChanges();
    }
  }

  get moviesPagesCount(): number { return Math.ceil(this.moviesTotal / this.moviesPageSize) || 1; }
  get funcionesPagesCount(): number { return Math.ceil(this.funcionesTotal / this.funcionesPageSize) || 1; }

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
  
  getMovieDynamicState(movie: any): string {
    if (movie.estado === 'retirada') return 'retirada';
    const today = this.supabase.getArgentinaDateString();
    return movie.fecha_estreno <= today ? 'cartelera' : 'proximamente';
  }

  async cambiarEstado(movie: Movie) {
    const isRetirada = movie.estado === 'retirada';
    const nextEstado = isRetirada ? 'cartelera' : 'retirada';
    if (confirm(`¿Cambiar estado a "${nextEstado}"? (Las películas activas se dividen automáticamente en Cartelera o Próximamente según su fecha de estreno)`)) {
      await this.supabase.client.from('peliculas').update({ estado: nextEstado }).eq('id', movie.id);
      await this.loadMoviesPaginated();
    }
  }

  // Funciones ABM
  abrirFormularioFuncion() {
    this.newFuncion = this.getEmptyFuncion();
    if (this.allMoviesLight.length > 0) this.newFuncion.pelicula_id = this.allMoviesLight[0].id;
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

  // Cupones
  abrirFormularioCupon(cupon?: any) {
    if (cupon) {
      this.newCupon = { ...cupon };
    } else {
      this.newCupon = { codigo: '', porcentaje_descuento: 20, activo: true, tipo_restriccion: 'ninguna' };
    }
    this.showCuponForm = true;
  }
  
  cerrarFormularioCupon() {
    this.showCuponForm = false;
  }

  async guardarCupon() {
    try {
      const { error } = this.newCupon.id
         ? await this.supabase.client.from('cupones').update(this.newCupon).eq('id', this.newCupon.id)
         : await this.supabase.client.from('cupones').insert(this.newCupon);
      if (error) throw error;
      alert('Cupón guardado.');
      this.cerrarFormularioCupon();
      await this.loadData();
    } catch(e:any) { alert('Error: ' + e.message); }
  }

  // Candy Bar
  abrirFormularioCandy(candy?: any) {
    if (candy) {
      this.newCandy = { ...candy };
    } else {
      this.newCandy = { nombre: '', categoria: 'Snacks', precio: 1000, imagen_url: '', es_combo: false, costo_puntos: 100, activo_canje: true, activo: true };
    }
    this.showCandyForm = true;
  }
  
  cerrarFormularioCandy() {
    this.showCandyForm = false;
  }

  async guardarCandy() {
    try {
      const { error } = this.newCandy.id
         ? await this.supabase.client.from('candy_productos').update(this.newCandy).eq('id', this.newCandy.id)
         : await this.supabase.client.from('candy_productos').insert(this.newCandy);
      if (error) throw error;
      alert('Candy guardado.');
      this.cerrarFormularioCandy();
      await this.loadData();
    } catch(e:any) { alert('Error: ' + e.message); }
  }

  // Combos
  abrirFormularioCombo(combo?: any) {
    if (combo) {
      this.newCombo = { 
        ...combo, 
        productos_incluidos: combo.combo_candy_productos ? combo.combo_candy_productos.map((c: any) => ({
            candy_producto_id: c.candy_producto_id,
            cantidad: c.cantidad
        })) : []
      };
    } else {
      this.newCombo = { titulo: '', descripcion: '', precio: 5000, entradas_incluidas: 2, activo: true, productos_incluidos: [] };
    }
    this.showComboForm = true;
  }
  
  cerrarFormularioCombo() {
    this.showComboForm = false;
  }

  agregarProductoCombo(candyId: string) {
    if (!candyId) return;
    const existing = this.newCombo.productos_incluidos.find((p: any) => p.candy_producto_id === candyId);
    if (existing) {
       existing.cantidad++;
    } else {
       this.newCombo.productos_incluidos.push({ candy_producto_id: candyId, cantidad: 1 });
    }
  }
 
  removerProductoCombo(index: number) {
    this.newCombo.productos_incluidos.splice(index, 1);
  }

  async guardarCombo() {
    try {
      const comboData = { ...this.newCombo };
      delete comboData.productos_incluidos;
      delete comboData.combo_candy_productos;
      
      const { data, error } = this.newCombo.id
         ? await this.supabase.client.from('combos').update(comboData).eq('id', this.newCombo.id).select().single()
         : await this.supabase.client.from('combos').insert(comboData).select().single();
         
      if (error) throw error;
      
      if (this.newCombo.id) {
         await this.supabase.client.from('combo_candy_productos').delete().eq('combo_id', data.id);
      }
      
      if (this.newCombo.productos_incluidos && this.newCombo.productos_incluidos.length > 0) {
         const inserts = this.newCombo.productos_incluidos.map((p: any) => ({
           combo_id: data.id,
           candy_producto_id: p.candy_producto_id,
           cantidad: p.cantidad
         }));
         await this.supabase.client.from('combo_candy_productos').insert(inserts);
      }
      
      alert('Combo guardado.');
      this.cerrarFormularioCombo();
      await this.loadData();
    } catch(e:any) { alert('Error: ' + e.message); }
  }

  // Fidelizacion
  async guardarFidelizacion() {
    try {
      let dataToSave = { ...this.configPuntos };
      if (!dataToSave.id) delete dataToSave.id;
      
      const { error } = dataToSave.id
         ? await this.supabase.client.from('configuracion_puntos').update(dataToSave).eq('id', dataToSave.id)
         : await this.supabase.client.from('configuracion_puntos').insert(dataToSave);
      if (error) throw error;
      alert('Configuración de fidelización guardada.');
      await this.loadData();
    } catch(e:any) { alert('Error: ' + e.message); }
  }

  getCandyNombre(id: string) { const c = this.candyProductos.find(x => x.id === id); return c ? c.nombre : id; }
}
