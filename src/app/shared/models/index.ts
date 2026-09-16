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
