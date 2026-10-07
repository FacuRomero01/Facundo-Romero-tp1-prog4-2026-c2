import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { SpanishDatePipe } from '../../shared/pipes/spanish-date.pipe';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, SpanishDatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  userProfile: any = null;
  activeTickets: any[] = [];
  pastTickets: any[] = [];
  paginatedPastTickets: any[] = [];
  currentPage = 1;
  pageSize = 4;
  loading = true;

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    const session = await this.supabase.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    
    if (userId) {
      this.userProfile = await this.supabase.getProfile(userId);
      
      const { data: tickets } = await this.supabase.client
        .from('tickets')
        .select('*, funciones(fecha_hora, peliculas(id, titulo, imagen_url))')
        .eq('usuario_id', userId)
        .order('fecha_compra', { ascending: false });

      const now = new Date();
      this.activeTickets = [];
      this.pastTickets = [];

      if (tickets) {
        for (const t of tickets) {
          if (t.funciones && t.funciones.fecha_hora) {
            const funcionDate = new Date(t.funciones.fecha_hora);
            if (funcionDate > now) {
              this.activeTickets.push(t);
            } else {
              this.pastTickets.push(t);
            }
          }
        }
      }
    }
    
    this.updatePagination();
    this.loading = false;
    this.cdr.detectChanges();
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedPastTickets = this.pastTickets.slice(startIndex, startIndex + this.pageSize);
  }

  nextPage() {
    if (this.currentPage * this.pageSize < this.pastTickets.length) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.pastTickets.length / this.pageSize);
  }

  canCancel(fechaHora: string): boolean {
    const funcionDate = new Date(fechaHora);
    const limit = new Date(funcionDate.getTime() - (2 * 60 * 60 * 1000));
    return new Date() < limit;
  }

  async cancelTicket(ticket: any) {
    if (!confirm('¿Seguro que querés cancelar esta entrada? El dinero se te devolverá como crédito a favor en tu cuenta.')) {
      return;
    }

    try {
      this.loading = true;
      await this.supabase.client.from('tickets').update({ estado: 'cancelado' }).eq('id', ticket.id);
      await this.supabase.client.from('butacas_ocupadas').delete().eq('ticket_id', ticket.id);
      
      const newCredit = (this.userProfile.credito || 0) + ticket.precio_final;
      await this.supabase.client.from('perfiles').update({ credito: newCredit }).eq('id', this.userProfile.id);
      
      alert(`Entrada cancelada. Se acreditaron $${ticket.precio_final} a tu cuenta.`);
      await this.loadData();
    } catch (e) {
      console.error(e);
      alert('Error al cancelar');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  reviewPeliculaId = '';
  reviewRating = 5;
  reviewComment = '';

  abrirResena(peliculaId: string) {
    this.reviewPeliculaId = peliculaId;
    this.reviewRating = 5;
    this.reviewComment = '';
  }

  async enviarResena() {
    if (!this.reviewPeliculaId || this.reviewRating < 1 || this.reviewRating > 5) return;
    try {
      this.loading = true;
      await this.supabase.client.from('resenas').insert({
        pelicula_id: this.reviewPeliculaId,
        usuario_id: this.userProfile.id,
        puntuacion: this.reviewRating,
        comentario: this.reviewComment
      });
      alert('¡Gracias por tu reseña!');
      this.reviewPeliculaId = '';
    } catch (e) {
      console.error(e);
      alert('Error al enviar la reseña');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  // --- Lógica del modal de detalle de entrada ---
  showTicketModal = false;
  loadingModal = false;
  selectedTicketDetails: any = null;
  selectedQrUrl = '';

  async abrirDetalleEntrada(ticket: any) {
    this.showTicketModal = true;
    this.loadingModal = true;
    this.selectedTicketDetails = null;
    this.cdr.detectChanges();

    try {
      // Reutilizamos validateTicket que ya trae butacas, candy, sala y película completa.
      this.selectedTicketDetails = await this.supabase.validateTicket(ticket.codigo_qr);
      this.selectedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.codigo_qr)}`;
    } catch (e) {
      console.error('Error al cargar detalle de entrada:', e);
      alert('Hubo un error al cargar el detalle de la entrada.');
      this.showTicketModal = false;
    } finally {
      this.loadingModal = false;
      this.cdr.detectChanges();
    }
  }

  cerrarModalEntrada() {
    this.showTicketModal = false;
    this.selectedTicketDetails = null;
  }
}
