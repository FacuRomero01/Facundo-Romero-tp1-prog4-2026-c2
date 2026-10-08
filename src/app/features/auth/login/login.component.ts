import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  errorMessage = '';
  loading = false;

  async ngOnInit() {
    const session = await this.supabase.auth.getSession();
    if (session?.data?.session) {
      const profile = await this.supabase.getProfile(session.data.session.user.id);
      if (profile?.rol === 'empleado') {
        this.router.navigate(['/validador']);
      } else {
        this.router.navigate(['/home']);
      }
    }
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const { email, password } = this.loginForm.value;

    try {
      const { user } = await this.supabase.signIn(email!, password!);
      
      if (user) {
        const profile = await this.supabase.getProfile(user.id);
        if (profile?.rol === 'empleado') {
          this.router.navigate(['/validador']);
        } else {
          this.router.navigate(['/home']);
        }
      } else {
        this.router.navigate(['/home']);
      }
    } catch (error: any) {
      if (error.message === 'Invalid login credentials') {
        this.errorMessage = 'El correo o la contraseña son incorrectos.';
      } else {
        this.errorMessage = error.message || 'Error al iniciar sesión';
      }
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  autoFill(email: string, pass: string) {
    this.loginForm.patchValue({
      email: email,
      password: pass
    });
  }
}
