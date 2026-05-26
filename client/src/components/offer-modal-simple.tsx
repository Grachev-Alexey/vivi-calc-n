import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Mail, User, Package, CreditCard, Clock } from "lucide-react";

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculation: any;
  selectedPackage: string | null;
  selectedServices: any[];
  downPayment: number;
  installmentMonths: number;
  usedCertificate: boolean;
  freeZones: any[];
  clientName: string;
  clientPhone: string;
  clientEmail: string;
}

export default function OfferModal({
  isOpen,
  onClose,
  calculation,
  selectedPackage,
  selectedServices,
  downPayment,
  installmentMonths,
  usedCertificate,
  freeZones,
  clientName,
  clientPhone,
  clientEmail
}: OfferModalProps) {
  const [isCreating, setIsCreating] = useState(false);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const getPackageName = (type: string) => {
    switch (type) {
      case 'vip': return 'VIP';
      case 'standard': return 'Стандарт';
      case 'economy': return 'Эконом';
      default: return type;
    }
  };

  const handleCreateAndSendOffer = async () => {
    if (!clientName || !clientPhone || !clientEmail) {
      alert('Заполните все данные клиента в основной форме');
      return;
    }

    if (!selectedPackage || !calculation) {
      alert('Выберите пакет и рассчитайте стоимость');
      return;
    }

    setIsCreating(true);
    try {
      const packageData = calculation.packages[selectedPackage];
      
      const offerData = {
        clientName,
        clientPhone,
        clientEmail,
        selectedServices: selectedServices.map(service => ({
          ...service,
          pricePerProcedure: parseFloat(service.priceMin)
        })),
        selectedPackage,
        baseCost: calculation.baseCost,
        finalCost: packageData.finalCost,
        totalSavings: packageData.totalSavings,
        downPayment,
        installmentMonths: installmentMonths > 1 ? installmentMonths : null,
        monthlyPayment: packageData.monthlyPayment,
        appliedDiscounts: packageData.appliedDiscounts || [],
        freeZones: freeZones || [],
        usedCertificate
      };

      // Создаем оферту
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerData)
      });

      if (response.ok) {
        const offer = await response.json();
        
        // Отправляем email с фиксированными настройками Yandex
        const sendResponse = await fetch(`/api/offers/${offer.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            emailConfig: {
              provider: 'yandex',
              email: 'vivilaser@yandex.ru',
              password: 'your_yandex_password'
            }
          })
        });

        if (sendResponse.ok) {
          alert('Договор-оферта успешно создан и отправлен клиенту!');
          onClose();
        } else {
          const error = await sendResponse.json();
          alert(`Оферта создана, но не отправлена: ${error.message}`);
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Ошибка создания оферты');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка создания оферты');
    } finally {
      setIsCreating(false);
    }
  };

  if (!calculation || !selectedPackage) return null;

  const packageData = calculation.packages[selectedPackage];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Создание договора-оферты
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Информация о клиенте */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Данные клиента
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">ФИО:</span>
                <span>{clientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Телефон:</span>
                <span>{clientPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Email:</span>
                <span>{clientEmail}</span>
              </div>
            </CardContent>
          </Card>

          {/* Информация о пакете */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5" />
                Выбранный пакет: {getPackageName(selectedPackage)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Базовая стоимость:</span>
                  <div className="font-semibold">{formatAmount(packageData.baseCost)} ₽</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Итоговая стоимость:</span>
                  <div className="font-semibold text-green-600">{formatAmount(packageData.finalCost)} ₽</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Экономия:</span>
                  <div className="font-semibold text-pink-600">{formatAmount(packageData.totalSavings)} ₽</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Первый взнос:</span>
                  <div className="font-semibold">{formatAmount(downPayment)} ₽</div>
                </div>
              </div>
              
              {installmentMonths > 1 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm text-gray-600">Рассрочка:</span>
                    <span className="font-medium">{installmentMonths} месяцев по {formatAmount(packageData.monthlyPayment)} ₽</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Услуги */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Включенные услуги</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedServices.map((service, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <span>{service.title}</span>
                    <span className="font-medium">{formatAmount(parseFloat(service.priceMin))} ₽</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Действия */}
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleCreateAndSendOffer}
              disabled={isCreating}
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Создание...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Создать и отправить
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}