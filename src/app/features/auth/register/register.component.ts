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
    if (this.registerForm.invalid) {
      this.errorMessage = 'Faltan completar campos obligatorios, o la contraseña tiene menos de 6 caracteres.';
      return;
    }

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
      
      const { data: cup } = await this.supabase.client.from('cupones').select('codigo, porcentaje_descuento').eq('tipo_restriccion', 'primera_compra').eq('activo', true).maybeSingle();
      const cupText = cup ? `\n\nTu código de cupón de bienvenida es: ${cup.codigo} (${cup.porcentaje_descuento}% OFF). ¡Anotalo para tu primera compra!` : '';
      
      alert(`¡Registro exitoso!${cupText}`);
      this.router.navigate(['/home']);
    } catch (error: any) {
      this.errorMessage = error.message || 'Error al registrarse';
    } finally {
      this.loading = false;
    }
  }
}
