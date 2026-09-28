import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'spanishDate',
  standalone: true
})
export class SpanishDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: 'date' | 'time' | 'short' = 'date'): string {
    if (!value) return '';
    const date = new Date(value);
    
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (format === 'date') {
      return `${dayName} ${dayNum} ${monthName}`;
    } else if (format === 'time') {
      return `${hours}:${minutes}`;
    } else if (format === 'short') {
      return `${dayNum}/${date.getMonth() + 1}/${date.getFullYear()}, ${hours}:${minutes}`;
    }
    
    return `${dayName} ${dayNum} ${monthName}`;
  }
}
