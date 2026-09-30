import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  isLoggedIn = signal(false);
  isAdmin = signal(false);
  isEmpleado = signal(false);

  async ngOnInit() {
    const { data } = await this.supabase.auth.getSession();
    this.updateState(data.session);

    this.supabase.auth.onAuthStateChange((event, session) => {
      this.updateState(session);
    });
  }

  private async updateState(session: any) {
    this.isLoggedIn.set(!!session);
    if (session?.user?.id) {
      const profile = await this.supabase.getProfile(session.user.id);
      this.isAdmin.set(profile?.rol === 'admin');
      this.isEmpleado.set(profile?.rol === 'empleado' || profile?.rol === 'admin');
    } else {
      this.isAdmin.set(false);
      this.isEmpleado.set(false);
    }
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }

  isLoginPage(): boolean {
    return this.router.url.includes('/login') || this.router.url.includes('/register');
  }
}
