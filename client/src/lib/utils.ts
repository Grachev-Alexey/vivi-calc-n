import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price).replace('RUB', '₽');
}

export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it starts with 8 or 7
  const normalized = cleaned.startsWith('8') ? '7' + cleaned.slice(1) : cleaned;
  
  // Format as +7 (xxx) xxx-xx-xx
  if (normalized.length === 11 && normalized.startsWith('7')) {
    return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  }
  
  return phone;
}

export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  const normalized = cleaned.startsWith('8') ? '7' + cleaned.slice(1) : cleaned;
  return normalized.length === 11 && normalized.startsWith('7');
}

export function calculateSavingsPercentage(originalPrice: number, finalPrice: number): number {
  return Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
}

export function generateSubscriptionTitle(services: any[], packageType: string): string {
  const serviceNames = services.map(s => s.title).join(', ');
  const packageName = {
    vip: 'VIP',
    standard: 'Стандарт',
    economy: 'Эконом'
  }[packageType] || packageType;
  
  return `Курс ${serviceNames} - ${packageName}`;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function getPackageIcon(packageType: string): string {
  const icons = {
    vip: 'fa-gem',
    standard: 'fa-star',
    economy: 'fa-leaf'
  };
  return (icons as any)[packageType] || 'fa-circle';
}

export function getPackageColor(packageType: string): string {
  const colors = {
    vip: 'from-purple-500 to-purple-600',
    standard: 'from-blue-500 to-blue-600',
    economy: 'from-green-500 to-green-600'
  };
  return (colors as any)[packageType] || 'from-gray-500 to-gray-600';
}
