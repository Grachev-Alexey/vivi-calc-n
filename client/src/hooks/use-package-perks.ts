import { useQuery } from "@tanstack/react-query";

export interface Perk {
  id: number;
  name: string;
  description?: string;
  icon: string;
  iconColor?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface PackagePerkValue {
  id: number;
  packageType: string;
  perkId: number;
  valueType: 'boolean' | 'text' | 'number';
  booleanValue?: boolean;
  textValue?: string;
  numberValue?: number;
  displayValue: string;
  tooltip?: string;
  customIcon?: string;
  customIconColor?: string;
  isHighlighted: boolean;
  isBest?: boolean;
  isActive: boolean;
  perk: Perk;
}

export function usePackagePerks() {
  return useQuery<PackagePerkValue[]>({
    queryKey: ['/api/perks'],
    queryFn: async () => {
      const response = await fetch('/api/perks');
      if (!response.ok) {
        throw new Error('Failed to fetch package perks');
      }
      return response.json();
    }
  });
}