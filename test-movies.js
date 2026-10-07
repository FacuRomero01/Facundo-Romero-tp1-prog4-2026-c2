const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hzekgbcnsxontyypojjp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZWtnYmNuc3hvbnR5eXBvampwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTg4MjIsImV4cCI6MjEwNTA5NDgyMn0.9FaVbhUbn163svVW7F9kV8-2M8EqsRW8LAofZAc30yo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from('peliculas')
        .select('id, titulo, estado, fecha_estreno, funciones(id, fecha_hora)')
        // .neq('estado', 'retirada')
        // .lte('fecha_estreno', today);

    console.log("Total peliculas:", data ? data.length : 0);
    
    if (data) {
        const activas = data.filter(p => p.estado !== 'retirada' && p.fecha_estreno <= today);
        console.log("Peliculas activas y estrenadas:", activas.length);

        const conFuncionesFuturas = activas.filter(movie => {
            const funcionesFuturas = movie.funciones?.filter(f => f.fecha_hora > nowIso);
            return funcionesFuturas && funcionesFuturas.length > 0;
        });

        console.log("Peliculas con funciones futuras:", conFuncionesFuturas.length);
        console.log("Peliculas con funciones futuras titulos:", conFuncionesFuturas.map(p => p.titulo));

        const sinFuncionesFuturas = activas.filter(movie => {
            const funcionesFuturas = movie.funciones?.filter(f => f.fecha_hora > nowIso);
            return !funcionesFuturas || funcionesFuturas.length === 0;
        });
        console.log("Peliculas estrenadas SIN funciones futuras titulos:", sinFuncionesFuturas.map(p => p.titulo));
    }
}
main();
