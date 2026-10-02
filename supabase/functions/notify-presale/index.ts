// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

let VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
let VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")?.replace(/^["']|["']$/g, '').trim() || "";
let VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")?.replace(/^["']|["']$/g, '').trim() || "";

try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  }
} catch (e) {
  console.error("Error setting VAPID details:", e, "Key length:", VAPID_PUBLIC_KEY.length);
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get today's date
    const today = new Date();
    // Add 7 days
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 7);
    const targetDateString = targetDate.toISOString().split('T')[0];

    // Find movies premiering in 7 days or less
    const { data: movies, error: moviesError } = await supabaseClient
      .from('peliculas')
      .select('id, titulo')
      .lte('fecha_estreno', targetDateString)
      .gte('fecha_estreno', today.toISOString().split('T')[0]); // Don't notify for past movies

    if (moviesError) throw moviesError;

    for (const movie of movies) {
      // Find unnotified subscriptions for this movie
      const { data: alerts, error: alertsError } = await supabaseClient
        .from('alertas_estrenos')
        .select('id, usuario_id')
        .eq('pelicula_id', movie.id)
        .eq('notificado', false);

      if (alertsError || !alerts) {
        console.error("Error fetching alerts:", alertsError);
        continue;
      }

      const notifiedAlerts: string[] = [];

      for (const alert of alerts) {
        // Fetch the user's push subscription
        const { data: sub, error: subError } = await supabaseClient
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('usuario_id', alert.usuario_id)
          .maybeSingle();

        if (subError || !sub) {
          console.error("Error fetching subscription for user", alert.usuario_id, subError);
          continue;
        }
        
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        const payload = JSON.stringify({
          notification: {
            title: "¡Preventa Disponible!",
            body: `Ya puedes comprar tus entradas para el estreno de ${movie.titulo} con precio de preventa.`,
            data: { url: `/checkout/${movie.id}` }
          }
        });

        try {
          if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
            await webpush.sendNotification(pushSubscription, payload);
          }
          notifiedAlerts.push(alert.id);
        } catch (error) {
          console.error('Error sending push notification', error);
        }
      }

      // Mark as notified
      if (notifiedAlerts.length > 0) {
        await supabaseClient
          .from('alertas_estrenos')
          .update({ notificado: true })
          .in('id', notifiedAlerts);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: movies.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
