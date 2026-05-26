import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  Calendar, 
  Phone, 
  User, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface SaleData {
  id: number;
  clientName: string | null;
  clientPhone: string;
  clientEmail: string | null;
  masterName: string;
  subscriptionTitle: string;
  selectedPackage: string;
  baseCost: string;
  finalCost: string;
  totalSavings: string;
  downPayment: string;
  installmentMonths: number;
  monthlyPayment: string;
  usedCertificate: boolean;
  createdAt: string;
  selectedServices: any[];
  appliedDiscounts: any[];
  freeZones: any[];
  pdfPath: string | null;
  offerNumber: string | null;
  emailSent: boolean | null;
}

interface MasterSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterName: string;
}

const ITEMS_PER_PAGE = 5;

export default function MasterSalesModal({ isOpen, onClose, masterName }: MasterSalesModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<SaleData | null>(null);

  const { data: salesData, isLoading } = useQuery<{ sales: SaleData[]; summary: any }>({
    queryKey: ['/api/master/sales'],
    enabled: isOpen
  });

  // Фильтрация продаж только для текущего мастера
  const masterSales = useMemo(() => {
    if (!salesData?.sales) return [];
    
    let filtered = salesData.sales.filter(sale => sale.masterName === masterName);

    // Поиск по тексту
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.clientName?.toLowerCase().includes(query) ||
        sale.clientPhone.includes(query) ||
        sale.subscriptionTitle.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [salesData?.sales, masterName, searchQuery]);

  // Статистика для мастера
  const masterStats = useMemo(() => {
    const totalSales = masterSales.length;
    const totalRevenue = masterSales.reduce((sum, sale) => sum + parseFloat(sale.finalCost), 0);
    const totalSavings = masterSales.reduce((sum, sale) => sum + parseFloat(sale.totalSavings), 0);
    const averageCheck = totalSales > 0 ? totalRevenue / totalSales : 0;

    const packageStats = masterSales.reduce((acc, sale) => {
      const pkg = sale.selectedPackage || 'unknown';
      if (!acc[pkg]) {
        acc[pkg] = { count: 0, revenue: 0 };
      }
      acc[pkg].count++;
      acc[pkg].revenue += parseFloat(sale.finalCost);
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    return {
      totalSales,
      totalRevenue,
      totalSavings,
      averageCheck,
      packageStats
    };
  }, [masterSales]);

  // Пагинация
  const totalPages = Math.ceil(masterSales.length / ITEMS_PER_PAGE);
  const paginatedSales = masterSales.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getPackageName = (packageType: string) => {
    switch (packageType) {
      case 'vip': return 'VIP';
      case 'standard': return 'Стандарт';
      case 'economy': return 'Эконом';
      default: return packageType;
    }
  };

  const getPackageBadgeColor = (packageType: string) => {
    switch (packageType) {
      case 'vip': return 'bg-purple-500';
      case 'standard': return 'bg-blue-500';
      case 'economy': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (selectedSale) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Детали продажи #{selectedSale.id}</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSale(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <SaleDetails sale={selectedSale} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Мои продажи - {masterName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по клиенту, телефону, абонементу..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8"
            />
          </div>

          {/* Список продаж */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">Загрузка продаж...</div>
            ) : paginatedSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "По вашему запросу ничего не найдено" : "У вас пока нет продаж"}
              </div>
            ) : (
              <>
                {paginatedSales.map((sale) => (
                  <div key={sale.id} className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={`${getPackageBadgeColor(sale.selectedPackage)} text-white text-xs`}>
                          {getPackageName(sale.selectedPackage)}
                        </Badge>
                        <span className="font-medium text-sm">{sale.subscriptionTitle}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <div className="font-bold">{parseFloat(sale.finalCost).toLocaleString()} ₽</div>
                          <div className="text-xs text-muted-foreground">
                            Экономия: {parseFloat(sale.totalSavings).toLocaleString()} ₽
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center space-x-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{sale.clientName || 'Клиент'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{sale.clientPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <span>Первый взнос: {parseFloat(sale.downPayment).toLocaleString()} ₽</span>
                        {sale.installmentMonths && (
                          <span>Рассрочка: {sale.installmentMonths} мес.</span>
                        )}
                        {sale.usedCertificate && (
                          <Badge variant="outline" className="text-xs">Сертификат</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(sale.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Пагинация */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <div className="text-sm text-muted-foreground">
                      Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, masterSales.length)} из {masterSales.length}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Компонент детальной информации о продаже
function SaleDetails({ sale }: { sale: SaleData }) {
  const getDiscountName = (type: string) => {
    switch (type) {
      case 'package': return 'Скидка по пакету';
      case 'correction': return 'Коррекция';
      case 'gift_sessions': return 'Подарочные сеансы';
      case 'certificate': return 'Сертификат';
      case 'bulk': return 'Скидка за количество';
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      {/* Основная информация */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="font-medium text-sm">Информация о клиенте</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Имя:</span>
                <span>{sale.clientName || 'Не указано'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Телефон:</span>
                <span>{sale.clientPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{sale.clientEmail || 'Не указано'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата:</span>
                <span>{format(new Date(sale.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="font-medium text-sm">Финансы</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Базовая стоимость:</span>
                <span>{parseFloat(sale.baseCost).toLocaleString()} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Итоговая стоимость:</span>
                <span className="font-bold">{parseFloat(sale.finalCost).toLocaleString()} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Экономия:</span>
                <span className="text-green-600">{parseFloat(sale.totalSavings).toLocaleString()} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Первый взнос:</span>
                <span>{parseFloat(sale.downPayment).toLocaleString()} ₽</span>
              </div>
              {sale.installmentMonths > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Рассрочка:</span>
                    <span>{sale.installmentMonths} месяцев</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ежемесячно:</span>
                    <span>{parseFloat(sale.monthlyPayment).toLocaleString()} ₽</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Абонемент */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-medium text-sm mb-2">Абонемент</h4>
          <div className="flex items-center justify-between">
            <span className="text-sm">{sale.subscriptionTitle}</span>
            <Badge className={`${
              sale.selectedPackage === 'vip' ? 'bg-purple-500' :
              sale.selectedPackage === 'standard' ? 'bg-blue-500' : 'bg-green-500'
            } text-white`}>
              {getPackageName(sale.selectedPackage)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Услуги */}
      {sale.selectedServices?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium text-sm mb-2">Услуги ({sale.selectedServices.length})</h4>
            <div className="space-y-2">
              {sale.selectedServices.map((service, index) => {
                const price = service.editedPrice || service.customPrice || service.price || service.priceMin || service.cost || 0;
                const quantity = service.quantity || service.count || 1;
                const totalPrice = parseFloat(price.toString()) * quantity;
                
                return (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div>
                      <div>{service.title || service.name || `Услуга ${index + 1}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {parseFloat(price.toString()).toLocaleString()} ₽ × {quantity}
                      </div>
                    </div>
                    <span className="font-medium">{totalPrice.toLocaleString()} ₽</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Скидки */}
      {sale.appliedDiscounts?.filter(discount => discount.type !== 'gift_sessions').length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium text-sm mb-2">Примененные скидки</h4>
            <div className="space-y-2">
              {sale.appliedDiscounts
                .filter(discount => discount.type !== 'gift_sessions')
                .map((discount, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span>{getDiscountName(discount.type)}</span>
                  <span className="text-green-600 font-medium">-{parseFloat(discount.amount || 0).toLocaleString()} ₽</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getPackageName(packageType: string) {
  switch (packageType) {
    case 'vip': return 'VIP';
    case 'standard': return 'Стандарт';
    case 'economy': return 'Эконом';
    default: return packageType;
  }
}