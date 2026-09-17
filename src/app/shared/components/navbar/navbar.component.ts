import { Component, inject, OnInit } from '@angular/core';
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

  isLoggedIn = false;

  ngOnInit() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.isLoggedIn = !!session;
    });
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/']);
  }
}
