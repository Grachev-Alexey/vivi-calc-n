import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Mail, Phone, User, Package, CreditCard } from "lucide-react";

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
  const [isSending, setIsSending] = useState(false);
  const [createdOffer, setCreatedOffer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('preview');

  const handleCreateAndSendOffer = async () => {
    if (!clientName || !clientPhone || !clientEmail) {
      alert('Заполните все данные клиента');
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
        appliedDiscounts: packageData.appliedDiscounts,
        freeZones,
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
        setCreatedOffer(offer);
        
        // Сразу отправляем email с настройками Yandex
        setIsSending(true);
        const sendResponse = await fetch(`/api/offers/${offer.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            emailConfig: {
              provider: 'yandex',
              email: 'vivilaser@yandex.ru', // Ваша почта Yandex
              password: 'your_yandex_password' // Ваш пароль от Yandex
            }
          })
        });

        if (sendResponse.ok) {
          alert('Договор-оферта успешно создан и отправлен клиенту!');
          onClose();
          setCreatedOffer(null);
          setActiveTab('preview');
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
      setIsSending(false);
    }
  };



  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const getPackageName = (packageType: string) => {
    switch (packageType) {
      case 'vip': return 'VIP';
      case 'standard': return 'Стандарт';
      case 'economy': return 'Эконом';
      default: return packageType;
    }
  };

  if (!calculation || !selectedPackage) {
    return null;
  }

  const packageData = calculation.packages[selectedPackage];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Создание договора-оферты
          </DialogTitle>
          <DialogDescription>
            Заполните данные клиента и настройте отправку индивидуального предложения
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Левая колонка - Данные */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="client">Данные клиента</TabsTrigger>
                <TabsTrigger value="email" disabled={!createdOffer}>Отправка</TabsTrigger>
              </TabsList>

              <TabsContent value="client" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Информация о клиенте
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="clientName">ФИО клиента</Label>
                      <Input
                        id="clientName"
                        value={clientData.name}
                        onChange={(e) => setClientData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Иванов Иван Иванович"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="clientPhone">Телефон</Label>
                      <Input
                        id="clientPhone"
                        value={clientData.phone}
                        onChange={(e) => setClientData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+7 (999) 123-45-67"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="clientEmail">Email</Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        value={clientData.email}
                        onChange={(e) => setClientData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="client@example.com"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleCreateOffer} 
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? 'Создание...' : 'Создать оферту'}
                </Button>
              </TabsContent>

              <TabsContent value="email" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Настройки email
                    </CardTitle>
                    <CardDescription>
                      Настройте отправку договора клиенту на email
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="provider">Провайдер email</Label>
                      <Select value={emailConfig.provider} onValueChange={(value) => 
                        setEmailConfig(prev => ({ ...prev, provider: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gmail">Gmail</SelectItem>
                          <SelectItem value="yandex">Yandex</SelectItem>
                          <SelectItem value="mailru">Mail.ru</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="senderEmail">Ваш email</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        value={emailConfig.email}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="your@email.com"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="senderPassword">
                        {emailConfig.provider === 'gmail' ? 'App Password' : 'Пароль'}
                      </Label>
                      <Input
                        id="senderPassword"
                        type="password"
                        value={emailConfig.password}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, password: e.target.value }))}
                        placeholder={emailConfig.provider === 'gmail' ? 'App Password от Gmail' : 'Пароль от почты'}
                      />
                      {emailConfig.provider === 'gmail' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Используйте App Password, не основной пароль
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleSendOffer} 
                  disabled={isSending}
                  className="w-full"
                >
                  {isSending ? 'Отправка...' : 'Отправить оферту'}
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          {/* Правая колонка - Превью */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Детали предложения
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Пакет:</span>
                    <span className="font-medium">{getPackageName(selectedPackage)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Базовая стоимость:</span>
                    <span>{formatAmount(calculation.baseCost)} ₽</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Экономия:</span>
                    <span className="font-medium">{formatAmount(packageData.totalSavings)} ₽</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Итого:</span>
                    <span>{formatAmount(packageData.finalCost)} ₽</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-medium">Условия оплаты</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Первоначальный взнос:</span>
                      <span className="font-medium">{formatAmount(downPayment)} ₽</span>
                    </div>
                    {installmentMonths > 1 && (
                      <>
                        <div className="flex justify-between">
                          <span>Рассрочка:</span>
                          <span>{installmentMonths} месяцев</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ежемесячный платеж:</span>
                          <span className="font-medium">{formatAmount(packageData.monthlyPayment)} ₽</span>
                        </div>
                      </>
                    )}
                    {usedCertificate && (
                      <div className="flex justify-between text-green-600">
                        <span>Сертификат:</span>
                        <span>Применён</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="font-medium mb-2">Состав пакета:</div>
                  <div className="space-y-1 text-sm">
                    {selectedServices.map((service, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{service.title}</span>
                        <span>{service.quantity} шт.</span>
                      </div>
                    ))}
                    {freeZones.length > 0 && (
                      <>
                        <div className="font-medium text-green-600 mt-2">Подарки:</div>
                        {freeZones.map((zone, index) => (
                          <div key={index} className="flex justify-between text-green-600">
                            <span>{zone.title}</span>
                            <span>{zone.quantity} шт.</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}