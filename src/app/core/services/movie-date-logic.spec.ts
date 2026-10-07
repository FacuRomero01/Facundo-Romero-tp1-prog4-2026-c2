import { SupabaseService } from './supabase.service';
import { Movie } from '../../shared/models';

describe('Movie Date Logic Tests', () => {
  let supabaseService: SupabaseService;

  beforeEach(() => {
    supabaseService = new SupabaseService();
  });

  describe('Timezone and Date string', () => {
    it('should return YYYY-MM-DD in Argentina timezone', () => {
      const dateString = supabaseService.getArgentinaDateString();
      expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Casos de Negocio', () => {
    // Simulamos la fecha actual de Argentina para los tests a "2026-10-10"
    const MOCK_TODAY = '2026-10-10';

    it('Caso A: Película próxima (Estreno > HOY) -> Preventa, no cartelera', () => {
      const pelicula: Movie = {
        titulo: 'Película A',
        sinopsis: '',
        duracion_minutos: 120,
        imagen_url: '',
        restriccion_edad: 'ATP',
        estado: 'cartelera', // Ignorado ahora
        fecha_estreno: '2026-10-11', // Mañana
        precio_preventa: 3000
      };

      const isProxima = pelicula.fecha_estreno > MOCK_TODAY;
      const isCartelera = pelicula.fecha_estreno <= MOCK_TODAY;

      expect(isProxima).toBe(true);
      expect(isCartelera).toBe(false);
      
      const precioActivo = isProxima && pelicula.precio_preventa ? pelicula.precio_preventa : 5000;
      expect(precioActivo).toBe(3000); // Precio Preventa
    });

    it('Caso B y C: Día de estreno y Película estrenada (Estreno <= HOY) -> Cartelera, Precio Base', () => {
      const pelicula: Movie = {
        titulo: 'Película B',
        sinopsis: '',
        duracion_minutos: 120,
        imagen_url: '',
        restriccion_edad: 'ATP',
        estado: 'proximamente', // Ignorado ahora
        fecha_estreno: '2026-10-10', // Hoy
        precio_preventa: 3000
      };

      const isProxima = pelicula.fecha_estreno > MOCK_TODAY;
      const isCartelera = pelicula.fecha_estreno <= MOCK_TODAY;

      expect(isProxima).toBe(false);
      expect(isCartelera).toBe(true);
      
      const precioBaseMock = 4500;
      const precioActivo = isProxima && pelicula.precio_preventa ? pelicula.precio_preventa : precioBaseMock;
      expect(precioActivo).toBe(4500); // Precio Base, ya estrenó
    });

    it('Caso D, E y F: Filtrado de Funciones Pasadas vs Futuras', () => {
      const mockNowIso = '2026-10-10T20:00:00.000Z';
      
      const funciones = [
        { id: '1', fecha_hora: '2026-10-09T22:00:00.000Z' }, // Caso F: Día anterior
        { id: '2', fecha_hora: '2026-10-10T18:00:00.000Z' }, // Caso D: Hoy pero ya pasó
        { id: '3', fecha_hora: '2026-10-10T22:00:00.000Z' }  // Caso E: Hoy en el futuro
      ];

      const funcionesFuturas = funciones.filter(f => f.fecha_hora > mockNowIso);
      
      expect(funcionesFuturas.length).toBe(1);
      expect(funcionesFuturas[0].id).toBe('3');
    });
  });
});
