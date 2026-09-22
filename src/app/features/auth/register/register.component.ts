import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  registerForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    fechaNacimiento: ['', Validators.required],
    tipoSangre: ['', Validators.required],
    colorOjos: ['', Validators.required],
    diasVacaciones: [14, [Validators.required, Validators.min(0)]]
  });

  errorMessage = '';
  loading = false;

  async onSubmit() {
    if (this.registerForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    const { email, password, nombre, apellido, fechaNacimiento, tipoSangre, colorOjos, diasVacaciones } = this.registerForm.value;

    try {
      const profileData = {
        nombre,
        apellido,
        fecha_nacimiento: fechaNacimiento,
        tipo_sangre: tipoSangre,
        color_ojos: colorOjos,
        dias_vacaciones: diasVacaciones,
        rol: 'cliente',
        puntos: 0,
        credito: 0
      };

      await this.supabase.signUp(email!, password!, profileData);
      alert('¡Registro exitoso! Ya ganaste tu cupón de 20% para tu primera compra.');
      this.router.navigate(['/home']);
    } catch (error: any) {
      this.errorMessage = error.message || 'Error al registrarse';
    } finally {
      this.loading = false;
    }
  }
}
