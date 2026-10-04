export interface Movie {
  id?: string;
  titulo: string;
  sinopsis: string;
  duracion_minutos: number;
  imagen_url: string;
  restriccion_edad: 'ATP' | '+13' | '+18';
  estado: 'proximamente' | 'cartelera' | 'retirada';
  fecha_estreno: string;
  precio_preventa?: number;
  generos?: { nombre: string }[] | any[];
}

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'cliente' | 'empleado' | 'admin';
  puntos: number;
  credito: number;
}

export interface ConfiguracionPuntos {
  id: string;
  monto_dinero: number;
  puntos_otorgados: number;
  activa: boolean;
  creado_en: string;
}

export interface ComboCandyProducto {
  combo_id: string;
  candy_producto_id: string;
  cantidad: number;
  candy_producto?: CandyProduct; // For join responses
}

export interface Combo {
  id: string;
  titulo: string;
  descripcion: string;
  precio: number;
  entradas_incluidas: number;
  activo: boolean;
  creado_en: string;
  combo_candy_productos?: ComboCandyProducto[];
}

export interface CandyProduct {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  imagen_url: string;
  es_combo: boolean;
  costo_puntos: number;
  activo_canje: boolean;
}

export interface HistorialPuntos {
  id: string;
  usuario_id: string;
  ticket_id?: string;
  puntos_ganados: number;
  puntos_gastados: number;
  motivo: string;
  snapshot_monto_dinero: number;
  snapshot_puntos_otorgados: number;
  fecha: string;
}
