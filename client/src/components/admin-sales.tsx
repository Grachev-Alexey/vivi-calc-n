import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  Calendar, 
  Phone, 
  User, 
  Search, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Download,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

interface SalesStats {
  sales: SaleData[];
  summary: {
    totalSales: number;
    totalRevenue: number;
    totalSavingsGiven: number;
    packageStats: Record<string, { count: number; revenue: number }>;
    masterStats: Record<string, { count: number; revenue: number }>;
  };
}

const ITEMS_PER_PAGE = 10;

export default function AdminSales() {
  const [searchQuery, setSearchQuery] = useState("");
  const [packageFilter, setPackageFilter] = useState("all");
  const [masterFilter, setMasterFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<SaleData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: salesData, isLoading } = useQuery<SalesStats>({
    queryKey: ['/api/admin/sales'],
    enabled: true
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: number) => {
      const response = await fetch(`/api/admin/sales/${saleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка удаления продажи');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sales'] });
      toast({
        title: "Продажа удалена",
        description: "Продажа успешно удалена из системы",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось удалить продажу",
      });
    }
  });

  const handleDeleteSale = (saleId: number) => {
    if (confirm("Вы уверены, что хотите удалить эту продажу? Это действие нельзя отменить.")) {
      deleteSaleMutation.mutate(saleId);
    }
  };

  // Фильтрация и поиск
  const filteredSales = useMemo(() => {
    if (!salesData?.sales) return [];

    let filtered = salesData.sales;

    // Поиск по тексту
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.clientName?.toLowerCase().includes(query) ||
        sale.clientPhone.includes(query) ||
        sale.masterName.toLowerCase().includes(query) ||
        sale.subscriptionTitle.toLowerCase().includes(query)
      );
    }

    // Фильтр по пакету
    if (packageFilter !== "all") {
      filtered = filtered.filter(sale => sale.selectedPackage === packageFilter);
    }

    // Фильтр по мастеру
    if (masterFilter !== "all") {
      filtered = filtered.filter(sale => sale.masterName === masterFilter);
    }

    // Фильтр по дате
    if (dateFilter !== "all") {
      const now = new Date();
      const saleDate = new Date();
      
      switch (dateFilter) {
        case "today":
          filtered = filtered.filter(sale => {
            const date = new Date(sale.createdAt);
            return date.toDateString() === now.toDateString();
          });
          break;
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(sale => new Date(sale.createdAt) >= weekAgo);
          break;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(sale => new Date(sale.createdAt) >= monthAgo);
          break;
      }
    }

    // Сортировка по дате (новые сначала)
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [salesData?.sales, searchQuery, packageFilter, masterFilter, dateFilter]);

  // Пагинация
  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Уникальные мастера для фильтра
  const uniqueMasters = useMemo(() => {
    if (!salesData?.sales) return [];
    return Array.from(new Set(salesData.sales.map(sale => sale.masterName)));
  }, [salesData?.sales]);

  if (isLoading) {
    return <div className="p-6">Загрузка статистики продаж...</div>;
  }

  if (!salesData) {
    return <div className="p-6">Нет данных о продажах</div>;
  }

  const { summary } = salesData;

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

  const resetFilters = () => {
    setSearchQuery("");
    setPackageFilter("all");
    setMasterFilter("all");
    setDateFilter("all");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего продаж</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSales}</div>
            <div className="text-xs text-muted-foreground">
              Найдено: {filteredSales.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общая выручка</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRevenue.toLocaleString()} ₽</div>
            <div className="text-xs text-muted-foreground">
              Отфильтровано: {filteredSales.reduce((sum, sale) => sum + parseFloat(sale.finalCost), 0).toLocaleString()} ₽
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общая экономия</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSavingsGiven.toLocaleString()} ₽</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средний чек</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalSales > 0 ? Math.round(summary.totalRevenue / summary.totalSales).toLocaleString() : 0} ₽
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Продажи</TabsTrigger>
          <TabsTrigger value="packages">По пакетам</TabsTrigger>
          <TabsTrigger value="masters">По мастерам</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Продажи</span>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <Filter className="h-4 w-4 mr-2" />
                    Сбросить фильтры
                  </Button>
                </div>
              </CardTitle>
              
              {/* Фильтры и поиск */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по клиенту, телефону, мастеру..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <Select value={packageFilter} onValueChange={setPackageFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все пакеты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все пакеты</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="standard">Стандарт</SelectItem>
                    <SelectItem value="economy">Эконом</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={masterFilter} onValueChange={setMasterFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все мастера" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все мастера</SelectItem>
                    {uniqueMasters.map(master => (
                      <SelectItem key={master} value={master}>{master}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все даты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все даты</SelectItem>
                    <SelectItem value="today">Сегодня</SelectItem>
                    <SelectItem value="week">За неделю</SelectItem>
                    <SelectItem value="month">За месяц</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {paginatedSales.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {filteredSales.length === 0 && searchQuery ? 
                      "По вашему запросу ничего не найдено" : 
                      "Продаж пока нет"
                    }
                  </p>
                ) : (
                  <>
                    {paginatedSales.map((sale) => (
                      <div key={sale.id} className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge className={`${getPackageBadgeColor(sale.selectedPackage)} text-white`}>
                              {getPackageName(sale.selectedPackage)}
                            </Badge>
                            <span className="font-medium">{sale.subscriptionTitle}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <div className="font-bold text-lg">{parseFloat(sale.finalCost).toLocaleString()} ₽</div>
                              <div className="text-sm text-muted-foreground">
                                Экономия: {parseFloat(sale.totalSavings).toLocaleString()} ₽
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Детали продажи #{sale.id}</DialogTitle>
                                  </DialogHeader>
                                  <SaleDetails sale={sale} />
                                </DialogContent>
                              </Dialog>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteSale(sale.id)}
                                disabled={deleteSaleMutation.isPending}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{sale.clientName || 'Клиент'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{sale.clientPhone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>Мастер: {sale.masterName}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>Базовая стоимость: {parseFloat(sale.baseCost).toLocaleString()} ₽</div>
                          <div>Первый взнос: {parseFloat(sale.downPayment).toLocaleString()} ₽</div>
                          {sale.installmentMonths && (
                            <div>Рассрочка: {sale.installmentMonths} мес.</div>
                          )}
                          {sale.monthlyPayment && (
                            <div>Ежемесячно: {parseFloat(sale.monthlyPayment).toLocaleString()} ₽</div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            {sale.usedCertificate && (
                              <Badge variant="outline">Сертификат</Badge>
                            )}
                            {sale.freeZones && sale.freeZones.length > 0 && (
                              <Badge variant="outline">Бесплатные зоны</Badge>
                            )}
                            {sale.selectedServices?.length > 0 && (
                              <Badge variant="outline">{sale.selectedServices.length} услуг</Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {format(new Date(sale.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Пагинация */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <div className="text-sm text-muted-foreground">
                          Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredSales.length)} из {filteredSales.length}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Назад
                          </Button>
                          <span className="text-sm">
                            Страница {currentPage} из {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Далее
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Статистика по пакетам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(summary.packageStats).map(([packageType, stats]) => (
                  <div key={packageType} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge className={`${getPackageBadgeColor(packageType)} text-white`}>
                        {getPackageName(packageType)}
                      </Badge>
                      <div>
                        <div className="font-medium">{stats.count} продаж</div>
                        <div className="text-sm text-muted-foreground">
                          Средний чек: {stats.count > 0 ? Math.round(stats.revenue / stats.count).toLocaleString() : 0} ₽
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{stats.revenue.toLocaleString()} ₽</div>
                      <div className="text-sm text-muted-foreground">
                        {((stats.revenue / summary.totalRevenue) * 100).toFixed(1)}% от общей выручки
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="masters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Статистика по мастерам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(summary.masterStats).map(([masterName, stats]) => (
                  <div key={masterName} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{masterName}</div>
                        <div className="text-sm text-muted-foreground">
                          {stats.count} продаж • Средний чек: {stats.count > 0 ? Math.round(stats.revenue / stats.count).toLocaleString() : 0} ₽
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{stats.revenue.toLocaleString()} ₽</div>
                      <div className="text-sm text-muted-foreground">
                        {((stats.revenue / summary.totalRevenue) * 100).toFixed(1)}% от общей выручки
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Компонент детальной информации о продаже
function SaleDetails({ sale }: { sale: SaleData }) {
  // Функция для получения понятного названия скидки
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

  // Вычисляем процент коррекции из appliedDiscounts
  const getCorrectionPercent = () => {
    if (!sale.appliedDiscounts) return null;
    const correctionDiscount = sale.appliedDiscounts.find((d: any) => d.type === 'correction');
    if (!correctionDiscount) return null;
    
    const baseCost = parseFloat(sale.baseCost);
    const correctionAmount = parseFloat(correctionDiscount.amount);
    return Math.round((correctionAmount / baseCost) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Основная информация */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Информация о клиенте</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Имя:</span>
              <span className="font-medium">{sale.clientName || 'Не указано'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Телефон:</span>
              <span className="font-medium">{sale.clientPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{sale.clientEmail || 'Не указано'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Мастер:</span>
              <span className="font-medium">{sale.masterName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Дата продажи:</span>
              <span className="font-medium">
                {format(new Date(sale.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
              </span>
            </div>
            {sale.pdfPath && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">PDF договор:</span>
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={sale.pdfPath} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Скачать PDF
                  </a>
                </Button>
              </div>
            )}
            {sale.emailSent && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email отправлен:</span>
                <Badge variant="default">Да</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Финансовая информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Базовая стоимость:</span>
              <span className="font-medium">{parseFloat(sale.baseCost).toLocaleString()} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Итоговая стоимость:</span>
              <span className="font-bold text-lg">{parseFloat(sale.finalCost).toLocaleString()} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Общая экономия:</span>
              <span className="font-medium text-green-600">{parseFloat(sale.totalSavings).toLocaleString()} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Первый взнос:</span>
              <span className="font-medium">{parseFloat(sale.downPayment).toLocaleString()} ₽</span>
            </div>
            {sale.installmentMonths > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Рассрочка:</span>
                  <span className="font-medium">{sale.installmentMonths} месяцев</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ежемесячный платеж:</span>
                  <span className="font-medium">{parseFloat(sale.monthlyPayment).toLocaleString()} ₽</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Абонемент и пакет */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Абонемент</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Название:</span>
            <span className="font-medium">{sale.subscriptionTitle}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Пакет:</span>
            <Badge className={`${
              sale.selectedPackage === 'vip' ? 'bg-purple-500' :
              sale.selectedPackage === 'standard' ? 'bg-blue-500' : 'bg-green-500'
            } text-white`}>
              {sale.selectedPackage === 'vip' ? 'VIP' :
               sale.selectedPackage === 'standard' ? 'Стандарт' : 'Эконом'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Выбранные услуги */}
      {sale.selectedServices?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Выбранные услуги ({sale.selectedServices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sale.selectedServices.map((service, index) => {
                // Получаем цену из разных возможных полей (включая customPrice для обратной совместимости)
                let price = service.editedPrice || service.customPrice || service.price || service.priceMin || service.cost;
                
                // Если цена все еще 0 или undefined, используем базовую цену
                if (!price || price === 0) {
                  price = service.priceMin || service.price || 0;
                }
                
                const quantity = service.quantity || service.count || 1;
                const totalPrice = parseFloat(price?.toString() || '0') * quantity;
                
                return (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{service.title || service.name || `Услуга ${index + 1}`}</div>
                      <div className="text-sm text-muted-foreground">
                        {parseFloat(price.toString()).toLocaleString()} ₽ × {quantity} сеанс{quantity > 1 ? (quantity > 4 ? 'ов' : 'а') : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-lg">{totalPrice.toLocaleString()} ₽</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Примененные скидки */}
      {sale.appliedDiscounts?.filter(discount => discount.type !== 'gift_sessions').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Примененные скидки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sale.appliedDiscounts
                .filter(discount => discount.type !== 'gift_sessions')
                .map((discount, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg border">
                  <div className="flex-1">
                    <div className="font-medium">{getDiscountName(discount.type)}</div>
                    {discount.type === 'correction' && getCorrectionPercent() && (
                      <div className="text-sm text-muted-foreground">
                        Процент коррекции: {getCorrectionPercent()}%
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-green-600 text-lg">-{parseFloat(discount.amount || 0).toLocaleString()} ₽</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Дополнительные опции */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Дополнительные опции</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Использован сертификат:</span>
              <Badge variant={sale.usedCertificate ? "default" : "secondary"}>
                {sale.usedCertificate ? "Да" : "Нет"}
              </Badge>
            </div>
            {sale.freeZones?.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Бесплатные зоны:</span>
                <Badge variant="outline">{sale.freeZones.length} зон</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}