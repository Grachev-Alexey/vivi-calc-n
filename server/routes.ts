import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createYclientsService } from "./services/yclients";
import { pdfGenerator } from "./services/pdf-generator";
import { EmailServiceFactory } from "./services/email-service";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "./db";
import { users, services, insertUserSchema, insertConfigSchema, insertServiceSchema, 
  insertSubscriptionTypeSchema, insertPackageSchema, config,
  packages as packagesTable, sales, clients, subscriptionTypes, offers } from "@shared/schema";
import fs from 'fs/promises';
import path from 'path';

// Extend session types
declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: string;
  }
}

interface YclientsConfig {
  token: string;
  authCookie: string;
  chainId: string;
  categoryId: string;
  branchIds: string[];
}

const authSchema = z.object({
  pin: z.string().min(4).max(6)
});

const clientSchema = z.object({
  phone: z.string().min(10),
  email: z.string().email().optional()
});

const calculationSchema = z.object({
  services: z.array(z.object({
    id: z.number(),
    quantity: z.number()
  })),
  packageType: z.enum(['vip', 'standard', 'economy']),
  downPayment: z.number(),
  installmentMonths: z.number().optional(),
  usedCertificate: z.boolean().default(false),
  freeZones: z.array(z.object({
    serviceId: z.number(),
    quantity: z.number()
  })).default([]),
  manualGiftSessions: z.record(z.string(), z.number()).optional(),
  saleDate: z.string().optional(),
  masterId: z.number().optional()
});

const offerSchema = z.object({
  saleId: z.number().optional(),
  clientName: z.string().min(1),
  clientPhone: z.string().min(10),
  clientEmail: z.string().email(),
  selectedServices: z.array(z.any()),
  selectedPackage: z.enum(['vip', 'standard', 'economy']),
  baseCost: z.number(),
  finalCost: z.number(),
  totalSavings: z.number(),
  downPayment: z.number(),
  installmentMonths: z.number().optional(),
  monthlyPayment: z.number().optional(),
  paymentSchedule: z.array(z.any()),
  appliedDiscounts: z.array(z.any()).optional(),
  freeZones: z.array(z.any()).optional(),
  usedCertificate: z.boolean().default(false),
  manualGiftSessions: z.record(z.string(), z.number()).optional(),
  saleDate: z.string().optional(),
  pdfVersion: z.enum(['standard', 'amendment']).optional()
});

const configSchema = z.object({
  key: z.string(),
  value: z.any()
});

export async function registerRoutes(app: Express): Promise<Server> {
  await storage.initializeDefaultData();
  
  // Authentication
  app.post("/api/auth", async (req, res) => {
    try {
      const { pin } = authSchema.parse(req.body);
      const user = await storage.getUserByPin(pin);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Неверный PIN-код" });
      }

      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;
      (req.session as any).userName = user.name;
      
      res.json({ 
        user: { 
          id: user.id, 
          name: user.name, 
          role: user.role,
          isActive: user.isActive
        } 
      });
    } catch (error) {
      res.status(400).json({ message: "Ошибка валидации данных" });
    }
  });

  app.post("/api/logout", (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });

  app.get("/api/auth/check", (req, res) => {
    const session = req.session as any;
    if (session?.userId) {
      res.json({ 
        user: { 
          id: session.userId, 
          name: session.userName || 'Пользователь', 
          role: session.userRole,
          isActive: true
        } 
      });
    } else {
      res.status(401).json({ message: "Не авторизован" });
    }
  });

  const requireAuth = (req: any, res: any, next: any) => {
    const session = req.session as any;
    if (!session?.userId) {
      return res.status(401).json({ message: "Требуется авторизация" });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    const session = req.session as any;
    if (!session?.userId || session.userRole !== 'admin') {
      return res.status(403).json({ message: "Требуются права администратора" });
    }
    next();
  };

  // Get active users (for admin dropdown in ClientModal)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const activeUsers = allUsers
        .filter(u => u.isActive)
        .map(u => ({
          id: u.id,
          name: u.name,
          role: u.role,
          isActive: u.isActive
        }));
      res.json(activeUsers);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения пользователей" });
    }
  });

  // Services
  app.get("/api/services", requireAuth, async (req, res) => {
    try {
      const servicesList = await storage.getActiveServices();
      res.json(servicesList);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения услуг" });
    }
  });

  app.post("/api/services/sync", requireAdmin, async (req, res) => {
    try {
      const yclientsConfig = await storage.getConfig('yclients');
      if (!yclientsConfig) {
        return res.status(400).json({ message: "Настройки Yclients не найдены" });
      }

      const yclientsService = createYclientsService(yclientsConfig.value as YclientsConfig);
      const servicesList = await yclientsService.getServices();
      
      for (const service of servicesList) {
        await storage.upsertService({
          yclientsId: service.id,
          title: service.title,
          priceMin: service.price_min.toString(),
          categoryId: service.category_id || null,
          isActive: true
        });
      }

      res.json({ message: "Услуги синхронизированы", count: servicesList.length });
    } catch (error) {
      res.status(500).json({ message: "Ошибка синхронизации услуг" });
    }
  });

  app.post("/api/subscription-types/sync", requireAdmin, async (req, res) => {
    try {
      const yclientsConfig = await storage.getConfig('yclients');
      if (!yclientsConfig) {
        return res.status(400).json({ message: "Настройки Yclients не найдены" });
      }

      const yclientsService = createYclientsService(yclientsConfig.value as YclientsConfig);
      const subscriptionTypesList = await yclientsService.getSubscriptionTypes();
      
      for (const subscriptionType of subscriptionTypesList) {
        await storage.upsertSubscriptionType({
          yclientsId: subscriptionType.id,
          title: subscriptionType.title,
          cost: subscriptionType.cost.toString(),
          allowFreeze: subscriptionType.allow_freeze,
          freezeLimit: subscriptionType.freeze_limit,
          balanceContainer: subscriptionType.balance_container
        });
      }

      res.json({ message: "Типы абонементов синхронизированы", count: subscriptionTypesList.length });
    } catch (error) {
      console.error("Error syncing subscription types:", error);
      res.status(500).json({ message: "Ошибка синхронизации типов абонементов" });
    }
  });

  app.get("/api/admin/subscription-types", requireAdmin, async (req, res) => {
    try {
      const subscriptionTypesList = await storage.getSubscriptionTypes();
      res.json(subscriptionTypesList);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения типов абонементов" });
    }
  });

  // Configuration
  app.get("/api/config/:key", requireAdmin, async (req, res) => {
    try {
      const configItem = await storage.getConfig(req.params.key);
      res.json(configItem?.value || null);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения настроек" });
    }
  });

  app.post("/api/config", requireAdmin, async (req, res) => {
    try {
      const { key, value } = configSchema.parse(req.body);
      const configItem = await storage.setConfig(key, value);
      res.json(configItem);
    } catch (error) {
      res.status(400).json({ message: "Ошибка сохранения настроек" });
    }
  });

  // Packages
  app.get("/api/packages", requireAuth, async (req, res) => {
    try {
      const packagesList = await storage.getPackages();
      res.json(packagesList);
    } catch (error) {
      console.error('Error getting packages:', error);
      res.status(500).json({ message: "Ошибка получения пакетов" });
    }
  });

  app.post("/api/admin/packages", requireAdmin, async (req, res) => {
    try {
      const packageData = req.body;
      const result = await storage.upsertPackage(packageData);
      res.json(result);
    } catch (error) {
      console.error('Error saving package:', error);
      res.status(500).json({ message: "Ошибка сохранения пакета" });
    }
  });

  // User management
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения пользователей" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { pin, role, name } = req.body;
      if (!pin || !role || !name) {
        return res.status(400).json({ message: "Необходимо заполнить все поля" });
      }
      
      const existingUser = await storage.getUserByPin(pin);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким PIN уже существует" });
      }

      const user = await storage.createUser({ pin, role, name, isActive: true });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Ошибка создания пользователя" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { pin, role, name, isActive } = req.body;
      
      if (pin) {
        const existingUser = await storage.getUserByPin(pin);
        if (existingUser && existingUser.id !== parseInt(id)) {
          return res.status(400).json({ message: "Пользователь с таким PIN уже существует" });
        }
      }

      const user = await storage.updateUser(parseInt(id), { pin, role, name, isActive });
      
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления пользователя" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      
      if ((req as any).session.userId === userId) {
        return res.status(400).json({ message: "Нельзя удалить самого себя" });
      }
      
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления пользователя" });
    }
  });

  // Service management
  app.get("/api/admin/services", requireAdmin, async (req, res) => {
    try {
      const servicesList = await storage.getAllServices();
      res.json(servicesList);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения услуг" });
    }
  });

  app.put("/api/admin/services/:yclientsId", requireAdmin, async (req, res) => {
    try {
      const { yclientsId } = req.params;
      const { isActive } = req.body;
      await storage.updateServiceStatus(parseInt(yclientsId), isActive);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления статуса услуги" });
    }
  });

  // Sales — admin view
  app.get("/api/admin/sales", requireAdmin, async (req, res) => {
    try {
      const salesData = await db.select({
        id: sales.id,
        clientPhone: clients.phone,
        clientEmail: clients.email,
        masterName: users.name,
        subscriptionTitle: subscriptionTypes.title,
        selectedPackage: sales.selectedPackage,
        baseCost: sales.baseCost,
        finalCost: sales.finalCost,
        totalSavings: sales.totalSavings,
        downPayment: sales.downPayment,
        installmentMonths: sales.installmentMonths,
        monthlyPayment: sales.monthlyPayment,
        usedCertificate: sales.usedCertificate,
        createdAt: sales.createdAt,
        selectedServices: sales.selectedServices,
        appliedDiscounts: sales.appliedDiscounts,
        freeZones: sales.freeZones,
        clientName: sql<string | null>`(
          SELECT client_name 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`,
        pdfPath: sql<string | null>`(
          SELECT pdf_path 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`,
        offerNumber: sql<string | null>`(
          SELECT offer_number 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`,
        emailSent: sql<boolean | null>`(
          SELECT email_sent 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(users, eq(sales.masterId, users.id))
      .leftJoin(subscriptionTypes, eq(sales.subscriptionTypeId, subscriptionTypes.id))
      .orderBy(desc(sales.createdAt));

      const totalSales = salesData.length;
      const totalRevenue = salesData.reduce((sum, sale) => sum + parseFloat(sale.finalCost || '0'), 0);
      const totalSavingsGiven = salesData.reduce((sum, sale) => sum + parseFloat(sale.totalSavings || '0'), 0);
      
      const packageStats = salesData.reduce((acc, sale) => {
        const pkg = sale.selectedPackage || 'unknown';
        if (!acc[pkg]) acc[pkg] = { count: 0, revenue: 0 };
        acc[pkg].count++;
        acc[pkg].revenue += parseFloat(sale.finalCost || '0');
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      const masterStats = salesData.reduce((acc, sale) => {
        const master = sale.masterName || 'Неизвестен';
        if (!acc[master]) acc[master] = { count: 0, revenue: 0 };
        acc[master].count++;
        acc[master].revenue += parseFloat(sale.finalCost || '0');
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      res.json({
        sales: salesData,
        summary: { totalSales, totalRevenue, totalSavingsGiven, packageStats, masterStats }
      });
    } catch (error) {
      console.error('Error getting sales stats:', error);
      res.status(500).json({ message: "Ошибка получения статистики продаж" });
    }
  });

  // Sales — master view
  app.get("/api/master/sales", requireAuth, async (req, res) => {
    try {
      const masterId = (req as any).session.userId;
      
      const salesData = await db.select({
        id: sales.id,
        clientPhone: clients.phone,
        clientEmail: clients.email,
        masterName: users.name,
        subscriptionTitle: subscriptionTypes.title,
        selectedPackage: sales.selectedPackage,
        baseCost: sales.baseCost,
        finalCost: sales.finalCost,
        totalSavings: sales.totalSavings,
        downPayment: sales.downPayment,
        installmentMonths: sales.installmentMonths,
        monthlyPayment: sales.monthlyPayment,
        usedCertificate: sales.usedCertificate,
        createdAt: sales.createdAt,
        selectedServices: sales.selectedServices,
        appliedDiscounts: sales.appliedDiscounts,
        freeZones: sales.freeZones,
        clientName: sql<string | null>`(
          SELECT client_name 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`,
        pdfPath: sql<string | null>`(
          SELECT pdf_path 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`,
        offerNumber: sql<string | null>`(
          SELECT offer_number 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`,
        emailSent: sql<boolean | null>`(
          SELECT email_sent 
          FROM offers 
          WHERE offers.sale_id = ${sales.id} 
          LIMIT 1
        )`
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(users, eq(sales.masterId, users.id))
      .leftJoin(subscriptionTypes, eq(sales.subscriptionTypeId, subscriptionTypes.id))
      .where(eq(sales.masterId, masterId))
      .orderBy(desc(sales.createdAt));

      const totalSales = salesData.length;
      const totalRevenue = salesData.reduce((sum, sale) => sum + parseFloat(sale.finalCost || '0'), 0);
      const totalSavingsGiven = salesData.reduce((sum, sale) => sum + parseFloat(sale.totalSavings || '0'), 0);
      
      const packageStats = salesData.reduce((acc, sale) => {
        const pkg = sale.selectedPackage || 'unknown';
        if (!acc[pkg]) acc[pkg] = { count: 0, revenue: 0 };
        acc[pkg].count++;
        acc[pkg].revenue += parseFloat(sale.finalCost || '0');
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      res.json({
        sales: salesData,
        summary: { totalSales, totalRevenue, totalSavingsGiven, packageStats }
      });
    } catch (error) {
      console.error('Error getting master sales:', error);
      res.status(500).json({ message: "Ошибка получения продаж мастера" });
    }
  });

  app.delete("/api/admin/sales/:id", requireAdmin, async (req, res) => {
    try {
      const saleId = parseInt(req.params.id);
      if (!saleId) return res.status(400).json({ message: "Неверный ID продажи" });
      await storage.deleteSale(saleId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting sale:', error);
      res.status(500).json({ message: "Ошибка удаления продажи" });
    }
  });

  // Subscription creation
  app.post("/api/subscription", requireAuth, async (req, res) => {
    try {
      const { client: clientData, calculation } = req.body;
      const { phone, email } = clientSchema.parse(clientData);
      
      let client = await storage.getClientByPhone(phone);
      if (!client) {
        client = await storage.createClient({ phone, email: email || null });
      }

      const yclientsConfig = await storage.getConfig('yclients');
      if (!yclientsConfig) {
        return res.status(400).json({ message: "Настройки Yclients не найдены" });
      }

      const yclientsService = createYclientsService(yclientsConfig.value as YclientsConfig);
      
      const allServices = await storage.getAllServices();
      const servicesWithTitles = calculation.services.map((service: any) => {
        const serviceData = allServices.find(s => s.yclientsId === service.id);
        return { ...service, title: serviceData?.title || 'Неизвестная услуга' };
      });
      calculation.services = servicesWithTitles;

      let subscriptionType = await storage.findSubscriptionType(
        calculation.services, 
        calculation.finalCost, 
        calculation.packageType
      );

      if (!subscriptionType) {
        const templateConfig = await storage.getConfig('subscriptionTemplate');
        const template = (templateConfig?.value as string) || "Курс {services} - {package}";
        
        const title = await generateSubscriptionTitle(template, calculation);
        
        const servicesForYclients = calculation.services.map((service: any) => ({
          serviceId: service.id || service.serviceId,
          count: service.sessionCount || service.count || 10
        }));

        const yclientsSubscriptionType = await yclientsService.createSubscriptionType({
          title,
          cost: calculation.finalCost,
          services: servicesForYclients,
          allowFreeze: getFreezePolicyForPackage(calculation.packageType),
          freezeLimit: getFreezeLimitForPackage(calculation.packageType),
          packageType: calculation.packageType
        });

        subscriptionType = await storage.upsertSubscriptionType({
          yclientsId: yclientsSubscriptionType.id,
          title: yclientsSubscriptionType.title,
          cost: yclientsSubscriptionType.cost.toString(),
          allowFreeze: yclientsSubscriptionType.allow_freeze,
          freezeLimit: yclientsSubscriptionType.freeze_limit,
          balanceContainer: yclientsSubscriptionType.balance_container
        });
      }

      const enrichedServices = calculation.services.map((service: any) => ({
        ...service,
        price: service.editedPrice || service.price || service.priceMin || service.cost || 0,
        priceMin: service.priceMin || service.price || service.editedPrice || service.cost || 0,
        quantity: service.sessionCount || service.quantity || service.count || 1,
        sessionCount: service.sessionCount || service.quantity || service.count || 1,
        count: service.sessionCount || service.quantity || service.count || 1
      }));

      const session = (req as any).session;
      let masterId = session.userId;
      
      if (session.userRole === 'admin') {
        if (!calculation.masterId) {
          return res.status(400).json({ 
            message: "Администратор должен явно выбрать мастера для продажи" 
          });
        }
        masterId = calculation.masterId;
      }
      
      const sale = await storage.createSale({
        clientId: client.id,
        masterId: masterId,
        subscriptionTypeId: subscriptionType.id,
        selectedServices: enrichedServices,
        selectedPackage: calculation.packageType,
        baseCost: calculation.baseCost.toString(),
        finalCost: calculation.finalCost.toString(),
        totalSavings: calculation.totalSavings.toString(),
        downPayment: calculation.downPayment.toString(),
        installmentMonths: calculation.installmentMonths || null,
        monthlyPayment: calculation.monthlyPayment?.toString() || null,
        appliedDiscounts: calculation.appliedDiscounts,
        freeZones: calculation.freeZones,
        usedCertificate: calculation.usedCertificate,
        manualGiftSessions: calculation.manualGiftSessions || {},
        saleDate: calculation.saleDate ? new Date(calculation.saleDate) : undefined
      });

      res.json({ 
        success: true, 
        subscriptionType: subscriptionType.title,
        saleId: sale.id 
      });
    } catch (error) {
      console.error('Subscription creation error:', error);
      res.status(500).json({ message: "Ошибка создания абонемента" });
    }
  });

  // Create PDF directory
  const pdfDir = path.join(process.cwd(), 'pdfs');
  try {
    await fs.access(pdfDir);
  } catch {
    await fs.mkdir(pdfDir, { recursive: true });
  }

  // Create offer
  app.post("/api/offers", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const paymentSchedule = generatePaymentSchedule(
        req.body.downPayment,
        req.body.finalCost,
        req.body.installmentMonths
      );
      
      const offerData = offerSchema.parse({
        ...req.body,
        paymentSchedule,
        appliedDiscounts: req.body.appliedDiscounts || [],
        freeZones: req.body.freeZones || []
      });
      
      const offerNumber = await generateUniqueOfferNumber();

      let client = await storage.getClientByPhone(offerData.clientPhone);
      if (!client) {
        client = await storage.createClient({
          phone: offerData.clientPhone,
          email: offerData.clientEmail
        });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const offer = await storage.createOffer({
        clientId: client.id,
        masterId: req.session.userId,
        saleId: offerData.saleId,
        offerNumber,
        selectedServices: offerData.selectedServices,
        selectedPackage: offerData.selectedPackage,
        baseCost: offerData.baseCost.toString(),
        finalCost: offerData.finalCost.toString(),
        totalSavings: offerData.totalSavings.toString(),
        downPayment: offerData.downPayment.toString(),
        installmentMonths: offerData.installmentMonths,
        monthlyPayment: offerData.monthlyPayment?.toString(),
        paymentSchedule: offerData.paymentSchedule,
        appliedDiscounts: offerData.appliedDiscounts || [],
        freeZones: offerData.freeZones || [],
        usedCertificate: offerData.usedCertificate,
        manualGiftSessions: offerData.manualGiftSessions || {},
        clientName: offerData.clientName,
        clientPhone: offerData.clientPhone,
        clientEmail: offerData.clientEmail,
        pdfVersion: offerData.pdfVersion || 'standard',
        saleDate: offerData.saleDate ? new Date(offerData.saleDate) : undefined,
        status: 'draft',
        expiresAt
      });

      res.json(offer);
    } catch (error) {
      console.error('Ошибка создания оферты:', error as any);
      res.status(500).json({ message: "Ошибка создания оферты" });
    }
  });

  // Send offer by email with PDF
  app.post("/api/offers/:id/send", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const offerId = parseInt(req.params.id);
      const offersList = await storage.getOffersByMaster(req.session.userId);
      const offer = offersList.find(o => o.id === offerId);
      
      if (!offer) return res.status(404).json({ message: "Оферта не найдена" });
      if (!offer.clientEmail) return res.status(400).json({ message: "Email клиента не указан" });

      const emailSettings = await storage.getConfig('email_settings');
      if (!emailSettings || !emailSettings.value) {
        return res.status(400).json({ message: "Настройки email не настроены" });
      }

      const emailConfig = emailSettings.value as any;
      const packagesList = await storage.getPackages();
      const packageData = packagesList.find(pkg => pkg.type === offer.selectedPackage);

      const pdfBuffer = await pdfGenerator.generateOfferPDF(offer, packageData);
      
      const fileName = `offer_${offer.offerNumber}.pdf`;
      const filePath = path.join(pdfDir, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      let emailService;
      switch (emailConfig.provider) {
        case 'gmail':
          emailService = EmailServiceFactory.createGmailService(emailConfig.email, emailConfig.password);
          break;
        case 'yandex':
          emailService = EmailServiceFactory.createYandexService(emailConfig.email, emailConfig.password);
          break;
        case 'mailru':
          emailService = EmailServiceFactory.createMailRuService(emailConfig.email, emailConfig.password);
          break;
        default:
          return res.status(400).json({ message: "Неподдерживаемый провайдер email" });
      }

      const connectionTest = await emailService.testConnection();
      if (!connectionTest) {
        return res.status(500).json({ message: "Ошибка подключения к почтовому серверу" });
      }

      const emailSent = await emailService.sendOfferEmail(offer, pdfBuffer);
      
      if (emailSent) {
        await storage.updateOffer(offer.id, {
          pdfPath: `/api/pdf/${fileName}`,
          emailSent: true,
          emailSentAt: new Date(),
          status: 'sent'
        });

        res.json({ success: true, message: "Оферта успешно отправлена", pdfPath: filePath });
      } else {
        res.status(500).json({ message: "Ошибка отправки email" });
      }
    } catch (error) {
      console.error('Ошибка отправки оферты:', error);
      res.status(500).json({ message: "Ошибка отправки оферты" });
    }
  });

  // Download PDF
  app.get("/api/pdf/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: "Недопустимое имя файла" });
      }
      
      const filePath = path.join(pdfDir, filename);
      const absolutePath = path.resolve(filePath);
      
      try {
        await fs.access(absolutePath);
      } catch (error) {
        return res.status(404).json({ message: "PDF файл не найден" });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.sendFile(absolutePath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ message: "Ошибка отправки файла" });
        }
      });
    } catch (error) {
      console.error('Ошибка скачивания PDF:', error);
      res.status(500).json({ message: "Ошибка скачивания PDF" });
    }
  });

  // Email settings
  app.get("/api/admin/email-settings", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ message: "Нет доступа" });
      }

      const settings = await storage.getConfig('email_settings');
      res.json(settings ? settings.value : null);
    } catch (error) {
      console.error('Ошибка получения настроек email:', error);
      res.status(500).json({ message: "Ошибка получения настроек email" });
    }
  });

  app.post("/api/admin/email-settings", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ message: "Нет доступа" });
      }

      const emailSettings = req.body;
      await storage.setConfig('email_settings', emailSettings);
      res.json({ success: true, message: "Настройки email сохранены" });
    } catch (error) {
      console.error('Ошибка сохранения настроек email:', error);
      res.status(500).json({ message: "Ошибка сохранения настроек email" });
    }
  });

  app.post("/api/admin/test-email", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ message: "Нет доступа" });
      }

      const { provider, email, password, host, port, secure } = req.body;
      
      let emailService;
      switch (provider) {
        case 'gmail':
          emailService = EmailServiceFactory.createGmailService(email, password);
          break;
        case 'yandex':
          emailService = EmailServiceFactory.createYandexService(email, password);
          break;
        case 'mailru':
          emailService = EmailServiceFactory.createMailRuService(email, password);
          break;
        case 'custom':
          const customConfig = {
            host, port, secure,
            auth: { user: email, pass: password },
            from: email
          };
          emailService = new (await import("./services/email-service")).EmailService(customConfig);
          break;
        default:
          return res.status(400).json({ success: false, error: "Неподдерживаемый провайдер" });
      }

      const testResult = await emailService.testConnection();
      if (testResult) {
        res.json({ success: true, message: "Подключение успешно" });
      } else {
        res.json({ success: false, error: "Ошибка подключения к почтовому серверу" });
      }
    } catch (error: any) {
      console.error('Ошибка тестирования email:', error);
      res.json({ success: false, error: error.message || "Ошибка тестирования подключения" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function generateSubscriptionTitle(template: string, calculation: any): Promise<string> {
  const packageNames = {
    'vip': 'ВИП',
    'standard': 'Стандарт',
    'economy': 'Эконом'
  };
  
  const packageName = packageNames[calculation.packageType as keyof typeof packageNames] || calculation.packageType;
  const uniqueNumber = await generateUniqueSubscriptionNumber();
  const serviceNames = calculation.services.map((s: any) => s.title || s.name).join(', ');
  
  return `${uniqueNumber} ${serviceNames} - ${packageName}`;
}

async function generateUniqueSubscriptionNumber(): Promise<string> {
  const firstDigit = Math.floor(Math.random() * 4) + 1;
  
  for (let attempts = 0; attempts < 100; attempts++) {
    const secondPart = Math.floor(Math.random() * 1000);
    const number = `${firstDigit}.${secondPart.toString().padStart(3, '0')}`;
    const existing = await storage.findSubscriptionByNumber(number);
    if (!existing) return number;
  }
  
  const timestamp = Date.now().toString().slice(-3);
  return `${firstDigit}.${timestamp}`;
}

function getFreezePolicyForPackage(packageType: string): boolean {
  return packageType !== 'none';
}

function getFreezeLimitForPackage(packageType: string): number {
  const limits = { vip: 999, standard: 180, economy: 90 };
  return (limits as any)[packageType] || 0;
}

async function generateUniqueOfferNumber(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  
  const existingOffers = await storage.getAllOffers();
  const thisMonthPattern = new RegExp(`^${year}${month}(\\d{3})$`);
  
  let maxNumber = 0;
  existingOffers.forEach(offer => {
    const match = offer.offerNumber.match(thisMonthPattern);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  });
  
  const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
  return `${year}${month}${nextNumber}`;
}

function generatePaymentSchedule(
  downPayment: number, 
  finalCost: number, 
  installmentMonths?: number
): { date: string; amount: number; description: string }[] {
  const schedule = [];
  const today = new Date();
  
  schedule.push({
    date: today.toLocaleDateString('ru-RU'),
    amount: downPayment,
    description: 'Первоначальный взнос'
  });
  
  if (installmentMonths && installmentMonths > 1) {
    const remainingAmount = finalCost - downPayment;
    const monthlyPayment = remainingAmount / installmentMonths;
    
    for (let i = 1; i <= installmentMonths; i++) {
      const paymentDate = new Date(today);
      paymentDate.setMonth(paymentDate.getMonth() + i);
      
      schedule.push({
        date: paymentDate.toLocaleDateString('ru-RU'),
        amount: monthlyPayment,
        description: `Платеж ${i} из ${installmentMonths}`
      });
    }
  }
  
  return schedule;
}
