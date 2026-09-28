# Propuesta de Design System: "Neon Cinema"

## 1. Análisis de Referencias y Dirección Visual
Basado en las imágenes de inspiración y las directivas proporcionadas, el sistema debe alejarse del aspecto genérico y minimalista actual (estilo Netflix/Dashboard), para abrazar una identidad propia, inmersiva y moderna. 

**Conceptos Clave Extraídos:**
- **Atmosférico y Espacial:** Sensación de amplitud oscura (noche), cortada por luces vibrantes.
- **Marquesinas y Neón:** Uso estratégico de brillos y bordes luminosos.
- **Contraste Extremo:** Textos claros sobre fondos casi negros, con acentos en colores saturados (magenta, violeta, fucsia, cian/azul eléctrico).
- **Toques Cálidos:** El naranja/amarillo como representación de la calidez de las luces clásicas de marquesina.
- **Materialidad Digital:** Elevación mediante sombras (`box-shadow`) y resplandores sutiles.

## 2. Análisis del Proyecto Actual
- **Estado Actual:** Angular con una paleta genérica (`#141414` fondo, `#e50914` rojo primario). Sin un sistema profundo de tokens CSS.
- **Componentes Identificados:** Home, Navbar, Auth (Login/Register), Checkout (Booking Flow, Seat Map, Candy Bar, Payment), Admin Dashboard.
- **Roles:** Cliente, Empleado, Administrador (los 3 mantendrán la identidad pero adaptarán su disposición).

---

## 3. Design System Proposal (Tokens CSS)

### Paleta de Colores
```css
:root {
  /* Fondos (Profundidad espacial) */
  --color-background: #09090e; /* Negro con un levísimo tinte azul/violeta */
  --color-background-secondary: #12101c; /* Ligeramente más elevado */
  --color-surface: #1c182c; /* Para cards y modales */
  --color-surface-hover: #26213c; 

  /* Colores de Identidad (Neón y Cinematográfico) */
  --color-primary: #d400ff; /* Fucsia / Magenta Neón */
  --color-primary-hover: #e855ff;
  
  --color-secondary: #4a00e0; /* Violeta / Azul profundo */
  --color-accent: #00e5ff; /* Azul eléctrico / Cian (para contrastar) */
  --color-accent-warm: #ffb300; /* Amarillo/Naranja (Marquesina/Pochoclos) */
  --color-cinema-red: #ff2a2a; /* Rojo brillante para alertas o butacas ocupadas */

  /* Textos */
  --color-text: #ffffff;
  --color-text-secondary: #b8b2c6;
  --color-text-muted: #6b647f;

  /* Estados */
  --color-success: #00e676;
  --color-warning: #ffea00;
  --color-error: #ff1744;
  --color-info: #2979ff;
}
```

### Tipografía
- **Headings (Títulos):** Una fuente sans-serif geométrica o condensada (ej. *Montserrat* o *Oswald* si se busca algo más cartelera, o *Outfit* para modernidad). Fuerte peso (Bold/Black).
- **Body:** *Inter* o *Roboto* para máxima legibilidad, especialmente en tablas o descripciones largas.

### Iluminación, Sombras y Efectos (Glows)
- **Glow Sutil (Bordes y botones):** 
  `--glow-primary: 0 0 10px rgba(212, 0, 255, 0.4), 0 0 20px rgba(212, 0, 255, 0.2);`
- **Sombras de Superficie:** 
  `--shadow-surface: 0 8px 32px rgba(0, 0, 0, 0.5);`
- **Bordes:** 
  `--border-subtle: 1px solid rgba(255, 255, 255, 0.05);`
  `--border-neon: 1px solid var(--color-primary);`

### Formas y Border Radius
- `--radius-sm: 6px;` (Para inputs y badges)
- `--radius-md: 12px;` (Para botones y cards pequeñas)
- `--radius-lg: 20px;` (Para modales y paneles grandes)

### Transiciones
- `--transition-fast: 0.2s ease-in-out;` (Para hovers)
- `--transition-smooth: 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);` (Para animaciones de cards y modales)

---

## 4. Guía de Componentes

1. **Botones:** 
   - *Primario:* Fondo transparente o oscuro con borde luminoso (Primary) y texto magenta, al hacer hover se rellena o intensifica el glow.
   - *Comprar / Acción Principal:* Fondo magenta con texto blanco y glow sutil.
2. **Cards (Cartelera / Candy Bar):** 
   - Fondo `--color-surface`.
   - Hover: Traslación sutil en Y (`transform: translateY(-5px)`), aumento del resplandor de la sombra, overlay oscuro disminuye la opacidad para revelar más el poster.
3. **Selección de Asientos:**
   - *Disponibles:* Borde `--color-accent` (Cian) y centro vacío.
   - *Seleccionados:* Rellenos de `--color-primary` (Magenta) con glow.
   - *Ocupados:* Color oscuro/rojo opaco y visualmente "apagados".
4. **Layouts por Rol:**
   - *Cliente:* Navegación superior expansiva, gran Hero, visuales inmersivas.
   - *Empleado / Admin:* Sidebar oscuro (`--color-background-secondary`), tablas en `--color-surface` con bordes sutiles. Botones de acción en colores de identidad.

---

## 5. Plan de Implementación
Si apruebas esta dirección, procederé en el siguiente orden sin romper lógica:
1. Reemplazar `src/styles.scss` con las variables y utilidades globales del Design System.
2. Adaptar `navbar` y estructura base (App Component).
3. Estilizar pantallas de Autenticación (Login/Register).
4. Transformar el Home (Hero) y la Cartelera.
5. Remodelar el flujo de Checkout (Selección de funciones, Asientos, Candy Bar, Pago).
6. Ajustar vistas de Admin/Empleado y garantizar responsiveness general.
