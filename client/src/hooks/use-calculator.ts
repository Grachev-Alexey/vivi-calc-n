import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { calculatePackagePricing } from "@/lib/calculator";

interface Service {
  id: number;
  yclientsId: number;
  title: string;
  priceMin: string;
}

interface SelectedService extends Service {
  quantity: number;
  sessionCount: number; // Добавляем количество сеансов для каждой услуги
  customPrice?: string; // Добавляем возможность кастомной цены
}

interface FreeZone {
  serviceId: number;
  title: string;
  pricePerProcedure: number;
  quantity: number;
}

interface Calculation {
  baseCost: number;
  packages: {
    vip: PackageData;
    standard: PackageData;
    economy: PackageData;
  };
  totalProcedures: number;
  freeZonesValue: number;
}

interface PackageData {
  isAvailable: boolean;
  unavailableReason: string;
  finalCost: number;
  totalSavings: number;
  monthlyPayment: number;
  appliedDiscounts: Array<{ type: string; amount: number }>;
}

interface Package {
  id: number;
  type: string;
  name: string;
  discount: string;
  minCost: string;
  minDownPaymentPercent: string;
  requiresFullPayment: boolean;
  giftSessions: number;
  bonusAccountPercent: string;
}

export function useCalculator() {
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [procedureCount, setProcedureCount] = useState(10); // Теперь это максимальное количество сеансов
  const [downPayment, setDownPayment] = useState(0);
  const [installmentMonths, setInstallmentMonths] = useState(1);
  const [usedCertificate, setUsedCertificate] = useState(false);
  const [freeZones, setFreeZones] = useState<FreeZone[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [correctionPercent, setCorrectionPercent] = useState(0);
  const [manualGiftSessions, setManualGiftSessions] = useState<Record<string, number>>({});
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  
  // Debounce refs
  const downPaymentTimeoutRef = useRef<NodeJS.Timeout>();
  const packageSelectionTimeoutRef = useRef<NodeJS.Timeout>();
  const isUserDragging = useRef(false);

  // Get services and packages from backend
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    enabled: true
  });

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ['/api/packages'],
    enabled: true,
    staleTime: 0,
    gcTime: 0  // Updated from cacheTime to gcTime
  });

  // Get calculator settings from config
  const { data: calculatorSettings } = useQuery({
    queryKey: ['/api/config/calculator-settings'],
    queryFn: async () => {
      const configs = await Promise.all([
        fetch('/api/config/minimum_down_payment', { credentials: 'include' }),
        fetch('/api/config/bulk_discount_threshold', { credentials: 'include' }),
        fetch('/api/config/bulk_discount_percentage', { credentials: 'include' }),
        fetch('/api/config/installment_months_options', { credentials: 'include' }),
        fetch('/api/config/certificate_discount_percentage', { credentials: 'include' }),
        fetch('/api/config/certificate_min_course_amount', { credentials: 'include' })
      ]);

      const [minPayment, bulkThreshold, bulkPercentage, monthsOptions, certificateAmount, certificateMinAmount] = await Promise.all(
        configs.map(response => response.ok ? response.json() : null)
      );

      return {
        minimumDownPayment: minPayment || 8000,
        bulkDiscountThreshold: bulkThreshold || 15,
        bulkDiscountPercentage: bulkPercentage || 0.05,
        installmentMonthsOptions: monthsOptions || [1, 2, 3, 4, 5, 6],
        certificateDiscountAmount: certificateAmount || 3000,
        certificateMinCourseAmount: certificateMinAmount || 25000
      };
    },
    enabled: true,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Обновляем procedureCount на основе максимального количества сеансов среди услуг
  const handleSessionCountChange = (maxSessionCount: number) => {
    setProcedureCount(maxSessionCount);
  };
  // Calculate total procedures (for display only, not for discount calculation)
  const totalProcedures = useMemo(() => {
    // Общее количество процедур = сумма всех sessionCount
    return selectedServices.reduce((sum, service) => sum + (service.sessionCount || 10), 0);
  }, [selectedServices, procedureCount]);

  // Frontend calculation function for instant response
  const calculateInstantly = useMemo(
    () => (
      servicesData: SelectedService[],
      procedures: number,
      payment: number,
      months: number,
      certificate: boolean,
      zones: FreeZone[]
    ) => {
      if (servicesData.length === 0) {
        setCalculation(null);
        return;
      }

      // Create service map for quick lookup
      const serviceMap = new Map<number, Service>(services.map((s: Service) => [s.yclientsId, s]));
      
      // Calculate base cost from selected services only
      let baseCost = 0;
      for (const selectedService of servicesData) {
        // Skip services that are in free zones
        const isFreeZone = zones.some(zone => zone.serviceId === selectedService.yclientsId);
        if (isFreeZone) continue;
        
        const service = serviceMap.get(selectedService.yclientsId);
        if (service) {
          // Use custom price if available, otherwise use service's priceMin
          const price = selectedService.customPrice ? parseFloat(selectedService.customPrice) : parseFloat(service.priceMin);
          // Используем индивидуальное количество сеансов для каждой услуги
          baseCost += price * selectedService.quantity * (selectedService.sessionCount || 10);
        }
      }
      


      // Calculate free zones value for display purposes only (don't subtract from base cost)
      let freeZonesValue = 0;
      for (const freeZone of zones) {
        // Для бесплатных зон используем максимальное количество сеансов
        freeZonesValue += freeZone.pricePerProcedure * freeZone.quantity * procedures;
      }


      // Convert packages array to config object with ALL database fields
      const packageConfig = packages.reduce((acc: any, pkg: Package) => {
        acc[pkg.type] = {
          discount: parseFloat(pkg.discount.toString()),
          minCost: parseFloat(pkg.minCost.toString()),
          minDownPaymentPercent: parseFloat(pkg.minDownPaymentPercent.toString()),
          requiresFullPayment: pkg.requiresFullPayment,
          giftSessions: manualGiftSessions[pkg.type] !== undefined ? manualGiftSessions[pkg.type] : (pkg.giftSessions || 0),
          bonusAccountPercent: parseFloat(pkg.bonusAccountPercent.toString()),
          minDownPayment: 0 // Will be calculated
        };
        return acc;
      }, {});


      


      // Prepare calculation parameters
      const calculationParams = {
        services: servicesData.map(service => ({
          id: service.yclientsId,
          quantity: service.quantity * (service.sessionCount || 10)
        })),
        packageType: 'economy',
        downPayment: payment,
        installmentMonths: months,
        usedCertificate: certificate,
        freeZones: zones,
        serviceMap,
        packageConfig,
        procedureCount: procedures,
        freeZonesValue,
        totalProcedures: servicesData.reduce((sum, s) => sum + (s.quantity * (s.sessionCount || 10)), 0),
        correctionPercent: correctionPercent
      };

      // Use the centralized calculation function with calculator settings
      const result = calculatePackagePricing(baseCost, calculationParams, calculatorSettings || {});
      

      setCalculation(result);
    },
    [services, packages, calculatorSettings, correctionPercent, manualGiftSessions]
  );

  // Debounced calculation trigger
  const debouncedCalculation = useCallback(() => {
    if (downPaymentTimeoutRef.current) {
      clearTimeout(downPaymentTimeoutRef.current);
    }
    
    downPaymentTimeoutRef.current = setTimeout(() => {
      calculateInstantly(
        selectedServices,
        procedureCount,
        downPayment,
        installmentMonths,
        usedCertificate,
        freeZones
      );
    }, isUserDragging.current ? 100 : 0); // Shorter debounce when dragging
  }, [selectedServices, procedureCount, downPayment, installmentMonths, usedCertificate, freeZones, correctionPercent, calculateInstantly]);

  // Initialize default installment months based on settings - set to minimum available
  useEffect(() => {
    if (calculatorSettings?.installmentMonthsOptions?.length) {
      const minMonths = Math.min(...calculatorSettings.installmentMonthsOptions);
      setInstallmentMonths(minMonths);
    }
    
    // Initialize manual gift sessions with default values from packages
    if (packages.length > 0) {
      const defaultGiftSessions = packages.reduce((acc: Record<string, number>, pkg: Package) => {
        if (manualGiftSessions[pkg.type] === undefined) {
          acc[pkg.type] = pkg.giftSessions || 0;
        }
        return acc;
      }, {});
      
      if (Object.keys(defaultGiftSessions).length > 0) {
        setManualGiftSessions(prev => ({ ...prev, ...defaultGiftSessions }));
      }
    }
  }, [calculatorSettings]);

  // Trigger calculation when dependencies change
  useEffect(() => {
    debouncedCalculation();
  }, [debouncedCalculation]);

  // Check if selected package is still available after calculation
  useEffect(() => {
    if (selectedPackage && calculation?.packages) {
      const packageData = calculation.packages[selectedPackage as keyof typeof calculation.packages];
      if (packageData && packageData.isAvailable === false) {
        // Package is no longer available, deselect it
        setSelectedPackage(null);
      }
    }
  }, [calculation, selectedPackage]);



  return {
    selectedServices,
    procedureCount,
    downPayment,
    installmentMonths,
    usedCertificate,
    freeZones,
    selectedPackage,
    calculation,
    packages,
    totalProcedures,
    calculatorSettings,
    correctionPercent,
    manualGiftSessions,
    handleSessionCountChange,
    setSelectedServices,
    setProcedureCount,
    setDownPayment: useCallback((value: number) => {
      isUserDragging.current = true;
      setDownPayment(value);
      // Reset dragging flag after a delay
      setTimeout(() => {
        isUserDragging.current = false;
      }, 500);
    }, []),
    setInstallmentMonths,
    setUsedCertificate,
    setFreeZones,
    setCorrectionPercent,
    setManualGiftSessions,
    setSelectedPackage: useCallback((packageType: string | null) => {
      setSelectedPackage(packageType);
      
      // Adjust down payment based on selected package requirements from DB
      if (packageType && calculation?.packages && packages.length > 0) {
        const packageData = calculation.packages[packageType as keyof typeof calculation.packages];
        const packageConfig = packages.find(p => p.type === packageType);
        
        if (packageData?.isAvailable && packageConfig) {
          let newDownPayment = downPayment;
          
          if (packageConfig.requiresFullPayment) {
            // Package requires full payment (like VIP)
            newDownPayment = packageData.finalCost;
          } else {
            // Calculate minimum down payment as percentage of package cost
            const minPaymentPercent = parseFloat(packageConfig.minDownPaymentPercent.toString());
            const minPayment = packageData.finalCost * minPaymentPercent;
            const globalMin = calculatorSettings?.minimumDownPayment || 8000;
            
            // Always set to minimum down payment when package is selected
            newDownPayment = Math.round(Math.max(minPayment, globalMin));
          }
          
          if (newDownPayment !== downPayment) {
            setDownPayment(newDownPayment);
          }
        }
      }
    }, [calculation, packages, calculatorSettings]),
    isLoading: !calculation && selectedServices.length > 0,
    getMaxDownPayment: () => {
      if (!selectedPackage || !calculation?.packages || packages.length === 0) return 50000;
      
      const packageData = calculation.packages[selectedPackage as keyof typeof calculation.packages];
      const packageConfig = packages.find(p => p.type === selectedPackage);
      
      if (!packageData?.isAvailable || !packageConfig) return 50000;
      
      // If package requires full payment, max = full cost
      if (packageConfig.requiresFullPayment) {
        return packageData.finalCost;
      }
      
      // Otherwise, max is full cost (user can pay up to 100%)
      return packageData.finalCost;
    },
    getMinDownPayment: () => {
      if (!selectedPackage || !calculation?.packages || packages.length === 0) return 8000;
      
      const packageData = calculation.packages[selectedPackage as keyof typeof calculation.packages];
      const packageConfig = packages.find(p => p.type === selectedPackage);
      
      if (!packageData?.isAvailable || !packageConfig) return 8000;
      
      // If package requires full payment, min = max = full cost
      if (packageConfig.requiresFullPayment) {
        return packageData.finalCost;
      }
      
      // Calculate minimum down payment as percentage of package cost
      const minPaymentPercent = parseFloat(packageConfig.minDownPaymentPercent.toString());
      const percentageBasedMin = Math.round(packageData.finalCost * minPaymentPercent);
      
      // Use the higher of percentage-based minimum or global minimum
      const globalMin = calculatorSettings?.minimumDownPayment || 8000;
      return Math.max(percentageBasedMin, globalMin);
    }
  };
}