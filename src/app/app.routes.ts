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

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'home',
    canActivate: [authGuard],
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
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/booking-flow/booking-flow.component').then(m => m.BookingFlowComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
