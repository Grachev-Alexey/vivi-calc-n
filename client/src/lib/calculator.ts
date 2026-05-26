// Frontend calculation logic moved from backend for better performance

export interface CalculationService {
  id: number;
  quantity: number;
}

export interface CalculationParams {
  services: CalculationService[];
  packageType: string;
  downPayment: number;
  installmentMonths: number;
  usedCertificate: boolean;
  freeZones: any[];
  serviceMap: Map<number, any>;
  packageConfig: any;
  procedureCount?: number;
  freeZonesValue?: number;
  totalProcedures?: number;
  correctionPercent?: number;
}

export interface PackageData {
  isAvailable: boolean;
  unavailableReason: string;
  finalCost: number;
  totalSavings: number;
  monthlyPayment: number;
  appliedDiscounts: Array<{ type: string; amount: number }>;
}

export interface CalculationResult {
  baseCost: number;
  packages: {
    vip: PackageData;
    standard: PackageData;
    economy: PackageData;
  };
  totalProcedures: number;
  freeZonesValue: number;
}

export function calculatePackagePricing(
  baseCost: number,
  params: CalculationParams,
  calculatorSettings?: any
): CalculationResult {

  
  const { packageConfig, freeZones, correctionPercent = 0 } = params;
  
  // Use package configuration from database - no defaults
  const packages = packageConfig;
  // Теперь totalProcedures уже рассчитано с учетом индивидуальных количеств сеансов
  const totalProcedures = params.totalProcedures || 0;
  
  const results: any = {};
  
  // Calculate for each package type
  for (const [packageType, config] of Object.entries(packages)) {
    const packageData = config as any;
    
    // Calculate all discounts even for unavailable packages for display purposes
    let discount = packageData.discount;
    
    if (packageData.dynamicDiscount) {
        // Используем только sessionCount для расчета стоимости
        // baseCost += price * selectedService.quantity * (selectedService.sessionCount || 10);
      discount = Math.max(discount, packageData.dynamicDiscount);
    }

    // Calculate certificate discount using configurable fixed amount
    const certificateDiscountAmount = calculatorSettings?.certificateDiscountAmount || 3000;
    const certificateMinAmount = calculatorSettings?.certificateMinCourseAmount || 25000;
    const certificateDiscount = params.usedCertificate && baseCost >= certificateMinAmount ? certificateDiscountAmount : 0;
    

    
    // Calculate bulk discount using configurable threshold and percentage
    const bulkThreshold = calculatorSettings?.bulkDiscountThreshold || 15;
    const bulkDiscountPercent = calculatorSettings?.bulkDiscountPercentage || 0.025;
    // Используем максимальное количество сеансов среди всех услуг
    const maxSessionCount = params.procedureCount || 1;
    const qualifiesForBulkDiscount = maxSessionCount >= bulkThreshold;
    const additionalDiscount = qualifiesForBulkDiscount ? baseCost * bulkDiscountPercent : 0;
    
    // Calculate correction discount (master adjustment, max 10%)
    const correctionDiscount = Math.min(correctionPercent, 30) * baseCost * 0.01;
    

    


    // Calculate gift session value based on package type
    // Gift sessions are calculated using the original cost per procedure (before discount and without free zones)
    const packageDiscount = baseCost * discount;
    // Рассчитываем стоимость одной процедуры на основе максимального количества сеансов (без учета бесплатных зон)
    const originalCostPerProcedure = maxSessionCount > 0 ? baseCost / maxSessionCount : 0;
    
    // Get gift sessions from package configuration (manual override takes precedence)
    const giftSessions = packageData.giftSessions || 0;
    const giftSessionValue = originalCostPerProcedure * giftSessions;



    // Calculate free zones value from params (this is for display only, not subtracted from cost)
    const freeZonesValue = params.freeZonesValue || 0;
    
    // Total savings - only actual discounts, free zones are separate gifts
    const actualDiscounts = packageDiscount + certificateDiscount + additionalDiscount + correctionDiscount;
    const totalSavings = actualDiscounts; // Only actual discounts, not gifts
    const finalCost = baseCost - actualDiscounts; // Actual cost without gift sessions

    // All packages are available for selection - payment constraints will be applied when selected
    const minDownPayment = Math.max(
      packageData.minDownPayment || 0,
      finalCost * packageData.minDownPaymentPercent
    );

    // Calculate monthly payment
    const remainingAmount = finalCost - params.downPayment;
    const monthlyPayment = params.installmentMonths > 0 && !packageData.requiresFullPayment ? remainingAmount / params.installmentMonths : 0;

    // Check if package meets minimum cost requirement
    const isAvailable = baseCost >= packageData.minCost;
    const shortage = packageData.minCost - baseCost;
    const unavailableReason = !isAvailable ? `Не хватает ${shortage.toLocaleString()} ₽ (минимум: ${packageData.minCost.toLocaleString()} ₽)` : '';

    results[packageType] = {
      isAvailable,
      unavailableReason,
      finalCost,
      totalSavings,
      monthlyPayment: isAvailable ? monthlyPayment : 0,
      appliedDiscounts: [
        { type: 'package', amount: packageDiscount },
        ...(qualifiesForBulkDiscount && additionalDiscount > 0 ? [{ type: 'bulk', amount: additionalDiscount }] : []),
        ...(certificateDiscount > 0 ? [{ type: 'certificate', amount: certificateDiscount }] : []),
        ...(correctionDiscount > 0 ? [{ type: 'correction', amount: correctionDiscount }] : []),
        ...(giftSessionValue > 0 ? [{ type: 'gift_sessions', amount: giftSessionValue }] : [])
      ]
    };
  }

  return {
    baseCost,
    packages: results,
    totalProcedures,
    freeZonesValue: params.freeZonesValue || 0
  };
}