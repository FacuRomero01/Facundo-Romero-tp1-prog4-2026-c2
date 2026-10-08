import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from './core/services/supabase.service';

const authGuard = async () => {
  const session = await inject(SupabaseService).auth.getSession();
  return session?.data?.session ? true : inject(Router).parseUrl('/login');
};

const adminGuard = async () => {
  const supabase = inject(SupabaseService);
  const session = (await supabase.auth.getSession())?.data?.session;
  if (!session) return inject(Router).parseUrl('/login');
  const profile = await supabase.getProfile(session.user.id);
  return profile?.rol === 'admin' ? true : inject(Router).parseUrl('/home');
};

const employeeGuard = async () => {
  const supabase = inject(SupabaseService);
  const session = (await supabase.auth.getSession())?.data?.session;
  if (!session) return inject(Router).parseUrl('/login');
  const profile = await supabase.getProfile(session.user.id);
  return (profile?.rol === 'empleado' || profile?.rol === 'admin') ? true : inject(Router).parseUrl('/home');
};

const homeGuard = async () => {
  const supabase = inject(SupabaseService);
  const session = (await supabase.auth.getSession())?.data?.session;
  if (!session) return true; // Guests can see home
  const profile = await supabase.getProfile(session.user.id);
  return profile?.rol === 'empleado' ? inject(Router).parseUrl('/validador') : true;
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    canActivate: [homeGuard],
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'checkout/:funcionId',
    canActivate: [homeGuard],
    loadComponent: () => import('./features/checkout/booking-flow/booking-flow.component').then(m => m.BookingFlowComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'validador',
    canActivate: [employeeGuard],
    loadComponent: () => import('./features/employee/scanner/scanner.component').then(m => m.ScannerComponent)
  },
  {
    path: 'profile',
    canActivate: [authGuard, homeGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
