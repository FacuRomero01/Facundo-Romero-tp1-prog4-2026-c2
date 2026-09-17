import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
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
    loadComponent: () => import('./features/checkout/booking-flow/booking-flow.component').then(m => m.BookingFlowComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
