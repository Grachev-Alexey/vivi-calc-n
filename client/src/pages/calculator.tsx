import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RangeSlider } from "@/components/ui/range-slider";
import { Calculator, LogOut, Star } from "lucide-react";
import ServiceSelector from "@/components/service-selector";
import ThreeBlockComparison from "@/components/three-block-comparison";
import PaymentConfig from "@/components/payment-config";
import ClientModal from "@/components/client-modal";
import { useCalculator } from "@/hooks/use-calculator";
import { usePackagePerks } from "@/hooks/use-package-perks";
import { formatPrice } from "@/lib/utils";

interface User {
  id: number;
  name: string;
  role: 'master' | 'admin';
}

interface CalculatorPageProps {
  user: User;
  onLogout: () => void;
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

interface SelectedService {
  id: number;
  yclientsId: number;
  title: string;
  priceMin: string;
  quantity: number;
  sessionCount: number;
  customPrice?: string;
  serviceId: number;
  pricePerProcedure: number;
}
export default function CalculatorPage({ user, onLogout }: CalculatorPageProps) {
  const [showClientModal, setShowClientModal] = useState(false);
  const packagePerksQuery = usePackagePerks();
  const packagePerkValues = packagePerksQuery.data || [];
  const {
    selectedServices,
    procedureCount,
    downPayment,
    installmentMonths,
    usedCertificate,
    freeZones,
    calculation,
    selectedPackage,
    packages,
    calculatorSettings,
    correctionPercent,
    manualGiftSessions,
    setSelectedServices,
    setProcedureCount,
    setDownPayment,
    setInstallmentMonths,
    setUsedCertificate,
    setFreeZones,
    setSelectedPackage,
    setManualGiftSessions,
    isLoading,
    getMinDownPayment,
    getMaxDownPayment
  } = useCalculator();

  const handleProceedToOrder = () => {
    if (!selectedPackage) {
      return;
    }
    setShowClientModal(true);
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex-shrink-0 header-card backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-premium)' }}>
                <Calculator className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--graphite)' }}>Калькулятор Абонементов</h1>
                <p className="text-sm text-gray-600">Студия лазерной эпиляции</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Мастер: {user.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Scroll */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 sm:px-6 lg:px-5 py-8 pb-16 max-w-7xl mx-auto custom-scrollbar">

        
          {/* Hero Section */}
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-gradient-to-r from-yellow-500/10 to-green-500/10 text-yellow-700 border-0 shadow-none">
              <Star className="w-4 h-4 mr-2" />
              Специальное предложение гостевого дня
            </Badge>
            <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--graphite)' }}>Создайте идеальный курс процедур</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Индивидуальный подбор услуг с максимальными выгодами и гибкими условиями оплаты
            </p>
          </div>

          {/* Service Selection */}
          <Card className="rounded p-3 mb-3">
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--graphite)' }}>Выбор услуг</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ServiceSelector
              selectedServices={selectedServices}
              onServicesChange={setSelectedServices}
              onAddFreeZone={setFreeZones}
              freeZones={freeZones}
              calculatorSettings={calculatorSettings}
            />
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Количество процедур</label>
              <div className="bg-gray-50 rounded p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-purple-600">{procedureCount}</span>
                  <span className="text-xs text-gray-600">процедур</span>
                </div>
                
                <RangeSlider
                  min={4}
                  max={20}
                  value={procedureCount}
                  onChange={setProcedureCount}
                />
                
                {procedureCount >= 15 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center text-sm text-blue-700">
                      <Star className="w-4 h-4 mr-2" />
                      При выборе ≥15 процедур дополнительная скидка +2,5%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          

        </Card>

        {/* Package Comparison */}
        {calculation && (
          <ThreeBlockComparison
            calculation={calculation}
            selectedPackage={selectedPackage}
            onPackageSelect={setSelectedPackage}
            packages={packages as Package[]}
            downPayment={downPayment}
            installmentMonths={installmentMonths}
            procedureCount={procedureCount}
            packagePerkValues={packagePerkValues}
            usedCertificate={usedCertificate}
            calculatorSettings={calculatorSettings}
            freeZones={freeZones}
            selectedServices={selectedServices.map(service => ({
              ...service,
              serviceId: service.yclientsId,
              pricePerProcedure: parseFloat(service.priceMin)
            }))}
            bulkDiscountThreshold={calculatorSettings?.bulkDiscountThreshold || 15}
            bulkDiscountPercentage={calculatorSettings?.bulkDiscountPercentage || 0.025}
            correctionPercent={correctionPercent}
            onManualGiftSessionsChange={setManualGiftSessions}
          />
        )}

        {/* Payment Configuration */}
        <PaymentConfig
          downPayment={downPayment}
          installmentMonths={installmentMonths}
          usedCertificate={usedCertificate}
          onDownPaymentChange={setDownPayment}
          onInstallmentMonthsChange={setInstallmentMonths}
          onCertificateChange={setUsedCertificate}
          baseCost={calculation?.baseCost || 0}
          selectedPackage={selectedPackage}
          calculation={calculation}
          getMinDownPayment={getMinDownPayment}
          getMaxDownPayment={getMaxDownPayment}
        />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleProceedToOrder}
            disabled={!selectedPackage || selectedServices.length === 0}
            className="text-lg py-4 px-8 font-semibold text-white"
            style={{ 
              background: 'var(--gradient-premium)',
              opacity: (!selectedPackage || selectedServices.length === 0) ? 0.5 : 1
            }}
          >
            <Star className="w-5 h-5 mr-2" />
            Оформить абонемент
          </Button>
          
          <Button
            variant="outline"
            className="border-2 text-gray-700 font-semibold py-4 px-8"
            style={{ 
              borderColor: 'hsl(338, 55%, 68%)',
              color: 'hsl(338, 55%, 68%)'
            }}
          >
            Сохранить как черновик
          </Button>
        </div>
        </div>
      </main>

      {/* Client Data Modal */}
      {showClientModal && (
        <ClientModal
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          calculation={calculation}
          selectedPackage={selectedPackage}
          selectedServices={selectedServices}
          procedureCount={procedureCount}
          downPayment={downPayment}
          installmentMonths={installmentMonths}
          usedCertificate={usedCertificate}
          freeZones={freeZones}
        />
      )}
    </div>
  );
}