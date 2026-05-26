import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createYclientsService } from "./services/yclients";
import { pdfGenerator } from "./services/pdf-generator";
import { EmailServiceFactory } from "./services/email-service";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { users, services, subscriptionTypes, packages as packagesTable, sales, insertUserSchema } from "@shared/schema";
import fs from 'fs/promises';
import path from 'path';

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

const authSchema = z.object({ pin: z.string().min(4).max(6) });

const configSchema = z.object({ key: z.string(), value: z.any() });

const subscriptionBodySchema = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().min(10),
  clientEmail: z.string().email().optional().or(z.literal('')),
  paymentSchedule: z.array(z.any()).optional(),
  pdfVersion: z.enum(['standard', 'amendment']).optional(),
  calculation: z.object({
    services: z.array(z.object({ id: z.number(), sessionCount: z.number().optional() }).passthrough()),
    packageType: z.enum(['vip', 'standard', 'economy']),
    baseCost: z.number(),
    finalCost: z.number(),
    totalSavings: z.number(),
    downPayment: z.number(),
    installmentMonths: z.number().optional(),
    monthlyPayment: z.number().optional(),
    usedCertificate: z.boolean().default(false),
    freeZones: z.array(z.any()).default([]),
    appliedDiscounts: z.array(z.any()).optional(),
    manualGiftSessions: z.record(z.string(), z.number()).optional(),
    saleDate: z.string().optional(),
    masterId: z.number().optional(),
  })
});

export async function registerRoutes(app: Express): Promise<Server> {
  await storage.initializeDefaultData();

  // ── Auth ─────────────────────────────────────────────────────────────

  app.post("/api/auth", async (req, res) => {
    try {
      const { pin } = authSchema.parse(req.body);
      const user = await storage.getUserByPin(pin);
      if (!user || !user.isActive) return res.status(401).json({ message: "Неверный PIN-код" });
      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;
      (req.session as any).userName = user.name;
      res.json({ user: { id: user.id, name: user.name, role: user.role, isActive: user.isActive } });
    } catch {
      res.status(400).json({ message: "Ошибка валидации данных" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session?.destroy(err => { if (err) console.error('Session destruction error:', err); });
    res.json({ success: true });
  });

  app.get("/api/auth/check", (req, res) => {
    const s = req.session as any;
    if (s?.userId) {
      res.json({ user: { id: s.userId, name: s.userName || 'Пользователь', role: s.userRole, isActive: true } });
    } else {
      res.status(401).json({ message: "Не авторизован" });
    }
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ message: "Требуется авторизация" });
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    const s = req.session as any;
    if (!s?.userId || s.userRole !== 'admin') return res.status(403).json({ message: "Требуются права администратора" });
    next();
  };

  // ── Users ─────────────────────────────────────────────────────────────

  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const all = await storage.getAllUsers();
      res.json(all.filter(u => u.isActive).map(u => ({ id: u.id, name: u.name, role: u.role, isActive: u.isActive })));
    } catch { res.status(500).json({ message: "Ошибка получения пользователей" }); }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try { res.json(await storage.getAllUsers()); }
    catch { res.status(500).json({ message: "Ошибка получения пользователей" }); }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { pin, role, name } = req.body;
      if (!pin || !role || !name) return res.status(400).json({ message: "Необходимо заполнить все поля" });
      if (await storage.getUserByPin(pin)) return res.status(400).json({ message: "Пользователь с таким PIN уже существует" });
      res.json(await storage.createUser({ pin, role, name, isActive: true }));
    } catch { res.status(500).json({ message: "Ошибка создания пользователя" }); }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { pin, role, name, isActive } = req.body;
      if (pin) {
        const ex = await storage.getUserByPin(pin);
        if (ex && ex.id !== id) return res.status(400).json({ message: "Пользователь с таким PIN уже существует" });
      }
      const user = await storage.updateUser(id, { pin, role, name, isActive });
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      res.json(user);
    } catch { res.status(500).json({ message: "Ошибка обновления пользователя" }); }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if ((req.session as any).userId === id) return res.status(400).json({ message: "Нельзя удалить самого себя" });
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Ошибка удаления пользователя" }); }
  });

  // ── Services ──────────────────────────────────────────────────────────

  app.get("/api/services", requireAuth, async (req, res) => {
    try { res.json(await storage.getActiveServices()); }
    catch { res.status(500).json({ message: "Ошибка получения услуг" }); }
  });

  app.get("/api/admin/services", requireAdmin, async (req, res) => {
    try { res.json(await storage.getAllServices()); }
    catch { res.status(500).json({ message: "Ошибка получения услуг" }); }
  });

  app.put("/api/admin/services/:yclientsId", requireAdmin, async (req, res) => {
    try {
      await storage.updateServiceStatus(parseInt(req.params.yclientsId), req.body.isActive);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Ошибка обновления статуса услуги" }); }
  });

  app.post("/api/services/sync", requireAdmin, async (req, res) => {
    try {
      const cfg = await storage.getConfig('yclients');
      if (!cfg) return res.status(400).json({ message: "Настройки Yclients не найдены" });
      const yclients = createYclientsService(cfg.value as YclientsConfig);
      const list = await yclients.getServices();
      for (const s of list) {
        await storage.upsertService({ yclientsId: s.id, title: s.title, priceMin: s.price_min.toString(), categoryId: s.category_id || null, isActive: true });
      }
      res.json({ message: "Услуги синхронизированы", count: list.length });
    } catch { res.status(500).json({ message: "Ошибка синхронизации услуг" }); }
  });

  // ── Subscription Types ────────────────────────────────────────────────

  app.get("/api/admin/subscription-types", requireAdmin, async (req, res) => {
    try { res.json(await storage.getSubscriptionTypes()); }
    catch { res.status(500).json({ message: "Ошибка получения типов абонементов" }); }
  });

  app.post("/api/subscription-types/sync", requireAdmin, async (req, res) => {
    try {
      const cfg = await storage.getConfig('yclients');
      if (!cfg) return res.status(400).json({ message: "Настройки Yclients не найдены" });
      const yclients = createYclientsService(cfg.value as YclientsConfig);
      const list = await yclients.getSubscriptionTypes();
      for (const st of list) {
        await storage.upsertSubscriptionType({
          yclientsId: st.id, title: st.title, cost: st.cost.toString(),
          allowFreeze: st.allow_freeze, freezeLimit: st.freeze_limit, balanceContainer: st.balance_container
        });
      }
      res.json({ message: "Типы абонементов синхронизированы", count: list.length });
    } catch (e) {
      console.error("Error syncing subscription types:", e);
      res.status(500).json({ message: "Ошибка синхронизации типов абонементов" });
    }
  });

  // ── Config ────────────────────────────────────────────────────────────

  app.get("/api/config/:key", requireAdmin, async (req, res) => {
    try {
      const c = await storage.getConfig(req.params.key);
      res.json(c?.value || null);
    } catch { res.status(500).json({ message: "Ошибка получения настроек" }); }
  });

  app.post("/api/config", requireAdmin, async (req, res) => {
    try {
      const { key, value } = configSchema.parse(req.body);
      res.json(await storage.setConfig(key, value));
    } catch { res.status(400).json({ message: "Ошибка сохранения настроек" }); }
  });

  // ── Packages ──────────────────────────────────────────────────────────

  app.get("/api/packages", requireAuth, async (req, res) => {
    try { res.json(await storage.getPackages()); }
    catch { res.status(500).json({ message: "Ошибка получения пакетов" }); }
  });

  app.post("/api/admin/packages", requireAdmin, async (req, res) => {
    try { res.json(await storage.upsertPackage(req.body)); }
    catch { res.status(500).json({ message: "Ошибка сохранения пакета" }); }
  });

  // ── Sales — admin view ────────────────────────────────────────────────

  app.get("/api/admin/sales", requireAdmin, async (req, res) => {
    try {
      const salesData = await db.select({
        id: sales.id,
        clientName: sales.clientName,
        clientPhone: sales.clientPhone,
        clientEmail: sales.clientEmail,
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
        pdfPath: sales.pdfPath,
        offerNumber: sales.offerNumber,
        emailSent: sales.emailSent,
      })
      .from(sales)
      .leftJoin(users, eq(sales.masterId, users.id))
      .leftJoin(subscriptionTypes, eq(sales.subscriptionTypeId, subscriptionTypes.id))
      .orderBy(desc(sales.createdAt));

      const totalRevenue = salesData.reduce((s, r) => s + parseFloat(r.finalCost || '0'), 0);
      const totalSavingsGiven = salesData.reduce((s, r) => s + parseFloat(r.totalSavings || '0'), 0);
      const packageStats = salesData.reduce((acc, r) => {
        const p = r.selectedPackage || 'unknown';
        if (!acc[p]) acc[p] = { count: 0, revenue: 0 };
        acc[p].count++; acc[p].revenue += parseFloat(r.finalCost || '0');
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);
      const masterStats = salesData.reduce((acc, r) => {
        const m = r.masterName || 'Неизвестен';
        if (!acc[m]) acc[m] = { count: 0, revenue: 0 };
        acc[m].count++; acc[m].revenue += parseFloat(r.finalCost || '0');
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      res.json({ sales: salesData, summary: { totalSales: salesData.length, totalRevenue, totalSavingsGiven, packageStats, masterStats } });
    } catch (e) {
      console.error('Error getting sales stats:', e);
      res.status(500).json({ message: "Ошибка получения статистики продаж" });
    }
  });

  // ── Sales — master view ───────────────────────────────────────────────

  app.get("/api/master/sales", requireAuth, async (req, res) => {
    try {
      const masterId = (req.session as any).userId;
      const salesData = await db.select({
        id: sales.id,
        clientName: sales.clientName,
        clientPhone: sales.clientPhone,
        clientEmail: sales.clientEmail,
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
        pdfPath: sales.pdfPath,
        offerNumber: sales.offerNumber,
        emailSent: sales.emailSent,
      })
      .from(sales)
      .leftJoin(users, eq(sales.masterId, users.id))
      .leftJoin(subscriptionTypes, eq(sales.subscriptionTypeId, subscriptionTypes.id))
      .where(eq(sales.masterId, masterId))
      .orderBy(desc(sales.createdAt));

      const totalRevenue = salesData.reduce((s, r) => s + parseFloat(r.finalCost || '0'), 0);
      const totalSavingsGiven = salesData.reduce((s, r) => s + parseFloat(r.totalSavings || '0'), 0);
      const packageStats = salesData.reduce((acc, r) => {
        const p = r.selectedPackage || 'unknown';
        if (!acc[p]) acc[p] = { count: 0, revenue: 0 };
        acc[p].count++; acc[p].revenue += parseFloat(r.finalCost || '0');
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      res.json({ sales: salesData, summary: { totalSales: salesData.length, totalRevenue, totalSavingsGiven, packageStats } });
    } catch (e) {
      console.error('Error getting master sales:', e);
      res.status(500).json({ message: "Ошибка получения продаж мастера" });
    }
  });

  app.delete("/api/admin/sales/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Неверный ID продажи" });
      await storage.deleteSale(id);
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Ошибка удаления продажи" }); }
  });

  // ── Subscription creation (merged: sale + Yclients) ──────────────────

  app.post("/api/subscription", requireAuth, async (req, res) => {
    try {
      const { clientName, clientPhone, clientEmail, paymentSchedule, pdfVersion, calculation } = subscriptionBodySchema.parse(req.body);
      const phone = clientPhone.replace(/\D/g, '');

      const yclientsConfig = await storage.getConfig('yclients');
      if (!yclientsConfig) return res.status(400).json({ message: "Настройки Yclients не найдены" });

      const yclientsService = createYclientsService(yclientsConfig.value as YclientsConfig);

      // Enrich services with titles
      const allServices = await storage.getAllServices();
      const enrichedServices = calculation.services.map((svc: any) => {
        const found = allServices.find(s => s.yclientsId === (svc.id ?? svc.serviceId));
        return {
          ...svc,
          title: found?.title || svc.title || svc.name || 'Услуга',
          price: svc.editedPrice || svc.price || svc.priceMin || svc.cost || 0,
          priceMin: svc.priceMin || svc.price || svc.editedPrice || svc.cost || 0,
          quantity: svc.sessionCount || svc.quantity || svc.count || 1,
          sessionCount: svc.sessionCount || svc.quantity || svc.count || 1,
          count: svc.sessionCount || svc.quantity || svc.count || 1,
        };
      });

      // Find or create Yclients subscription type
      let subscriptionType = await storage.findSubscriptionType(enrichedServices, calculation.finalCost, calculation.packageType);

      if (!subscriptionType) {
        const title = await generateSubscriptionTitle(calculation);
        const servicesForYclients = enrichedServices.map((s: any) => ({
          serviceId: s.id ?? s.serviceId,
          count: s.sessionCount || s.count || 10
        }));
        const yclientsType = await yclientsService.createSubscriptionType({
          title, cost: calculation.finalCost, services: servicesForYclients,
          allowFreeze: getFreezePolicyForPackage(calculation.packageType),
          freezeLimit: getFreezeLimitForPackage(calculation.packageType),
          packageType: calculation.packageType
        });
        subscriptionType = await storage.upsertSubscriptionType({
          yclientsId: yclientsType.id, title: yclientsType.title, cost: yclientsType.cost.toString(),
          allowFreeze: yclientsType.allow_freeze, freezeLimit: yclientsType.freeze_limit, balanceContainer: yclientsType.balance_container
        });
      }

      // Determine master
      const session = req.session as any;
      let masterId = session.userId;
      if (session.userRole === 'admin') {
        if (!calculation.masterId) return res.status(400).json({ message: "Администратор должен явно выбрать мастера" });
        masterId = calculation.masterId;
      }

      const offerNumber = await generateUniqueOfferNumber();

      const sale = await storage.createSale({
        masterId,
        subscriptionTypeId: subscriptionType.id,
        offerNumber,
        clientName,
        clientPhone: phone,
        clientEmail: clientEmail || null,
        selectedServices: enrichedServices,
        selectedPackage: calculation.packageType,
        baseCost: calculation.baseCost.toString(),
        finalCost: calculation.finalCost.toString(),
        totalSavings: calculation.totalSavings.toString(),
        downPayment: calculation.downPayment.toString(),
        installmentMonths: calculation.installmentMonths || null,
        monthlyPayment: calculation.monthlyPayment?.toString() || null,
        paymentSchedule: paymentSchedule || null,
        appliedDiscounts: calculation.appliedDiscounts || [],
        freeZones: calculation.freeZones || [],
        usedCertificate: calculation.usedCertificate,
        manualGiftSessions: calculation.manualGiftSessions || {},
        pdfVersion: pdfVersion || 'standard',
        status: 'draft',
        saleDate: calculation.saleDate ? new Date(calculation.saleDate) : undefined,
      });

      res.json({ success: true, subscriptionType: subscriptionType.title, saleId: sale.id, offerNumber });
    } catch (e: any) {
      console.error('Subscription creation error:', e);
      res.status(500).json({ message: e.message || "Ошибка создания абонемента" });
    }
  });

  // ── PDF directory ─────────────────────────────────────────────────────

  const pdfDir = path.join(process.cwd(), 'pdfs');
  try { await fs.access(pdfDir); } catch { await fs.mkdir(pdfDir, { recursive: true }); }

  // ── Send sale contract (PDF + email) ─────────────────────────────────

  app.post("/api/sales/:id/send", requireAuth, async (req, res) => {
    try {
      const saleId = parseInt(req.params.id);
      const sale = await storage.getSaleById(saleId);
      if (!sale) return res.status(404).json({ message: "Продажа не найдена" });
      if (!sale.clientEmail) return res.status(400).json({ message: "Email клиента не указан" });

      const emailSettings = await storage.getConfig('email_settings');
      if (!emailSettings?.value) return res.status(400).json({ message: "Настройки email не настроены" });

      const emailConfig = emailSettings.value as any;
      const packages = await storage.getPackages();
      const packageData = packages.find(p => p.type === sale.selectedPackage);

      const pdfBuffer = await pdfGenerator.generateOfferPDF(sale, packageData);
      const fileName = `offer_${sale.offerNumber}.pdf`;
      const filePath = path.join(pdfDir, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      let emailService;
      switch (emailConfig.provider) {
        case 'gmail':  emailService = EmailServiceFactory.createGmailService(emailConfig.email, emailConfig.password); break;
        case 'yandex': emailService = EmailServiceFactory.createYandexService(emailConfig.email, emailConfig.password); break;
        case 'mailru': emailService = EmailServiceFactory.createMailRuService(emailConfig.email, emailConfig.password); break;
        default: return res.status(400).json({ message: "Неподдерживаемый провайдер email" });
      }

      if (!await emailService.testConnection()) {
        return res.status(500).json({ message: "Ошибка подключения к почтовому серверу" });
      }

      const sent = await emailService.sendOfferEmail(sale, pdfBuffer);
      if (sent) {
        await storage.updateSale(saleId, { pdfPath: `/api/pdf/${fileName}`, emailSent: true, emailSentAt: new Date(), status: 'sent' });
        res.json({ success: true, message: "Договор успешно отправлен", pdfPath: `/api/pdf/${fileName}` });
      } else {
        res.status(500).json({ message: "Ошибка отправки email" });
      }
    } catch (e) {
      console.error('Ошибка отправки договора:', e);
      res.status(500).json({ message: "Ошибка отправки договора" });
    }
  });

  // ── Download PDF ─────────────────────────────────────────────────────

  app.get("/api/pdf/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: "Недопустимое имя файла" });
      }
      const filePath = path.resolve(path.join(pdfDir, filename));
      try { await fs.access(filePath); } catch { return res.status(404).json({ message: "PDF файл не найден" }); }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(filePath, err => { if (err && !res.headersSent) res.status(500).json({ message: "Ошибка отправки файла" }); });
    } catch { res.status(500).json({ message: "Ошибка скачивания PDF" }); }
  });

  // ── Email settings ────────────────────────────────────────────────────

  app.get("/api/admin/email-settings", requireAdmin, async (req, res) => {
    try {
      const s = await storage.getConfig('email_settings');
      res.json(s ? s.value : null);
    } catch { res.status(500).json({ message: "Ошибка получения настроек email" }); }
  });

  app.post("/api/admin/email-settings", requireAdmin, async (req, res) => {
    try {
      await storage.setConfig('email_settings', req.body);
      res.json({ success: true, message: "Настройки email сохранены" });
    } catch { res.status(500).json({ message: "Ошибка сохранения настроек email" }); }
  });

  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    try {
      const { provider, email, password, host, port, secure } = req.body;
      let emailService: any;
      switch (provider) {
        case 'gmail':  emailService = EmailServiceFactory.createGmailService(email, password); break;
        case 'yandex': emailService = EmailServiceFactory.createYandexService(email, password); break;
        case 'mailru': emailService = EmailServiceFactory.createMailRuService(email, password); break;
        case 'custom':
          const cfg = { host, port, secure, auth: { user: email, pass: password }, from: email };
          emailService = new (await import("./services/email-service")).EmailService(cfg);
          break;
        default: return res.json({ success: false, error: "Неподдерживаемый провайдер" });
      }
      const ok = await emailService.testConnection();
      res.json(ok ? { success: true, message: "Подключение успешно" } : { success: false, error: "Ошибка подключения к почтовому серверу" });
    } catch (e: any) {
      res.json({ success: false, error: e.message || "Ошибка тестирования подключения" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function generateSubscriptionTitle(calculation: any): Promise<string> {
  const packageNames: Record<string, string> = { vip: 'ВИП', standard: 'Стандарт', economy: 'Эконом' };
  const packageName = packageNames[calculation.packageType] || calculation.packageType;
  const number = await generateUniqueSubscriptionNumber();
  const serviceNames = calculation.services.map((s: any) => s.title || s.name).join(', ');
  return `${number} ${serviceNames} - ${packageName}`;
}

async function generateUniqueSubscriptionNumber(): Promise<string> {
  const first = Math.floor(Math.random() * 4) + 1;
  for (let i = 0; i < 100; i++) {
    const n = Math.floor(Math.random() * 1000);
    const candidate = `${first}.${n.toString().padStart(3, '0')}`;
    if (!await storage.findSubscriptionByNumber(candidate)) return candidate;
  }
  return `${first}.${Date.now().toString().slice(-3)}`;
}

async function generateUniqueOfferNumber(): Promise<string> {
  const y = new Date().getFullYear().toString().slice(-2);
  const m = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const allSales = await storage.getAllSales();
  const pattern = new RegExp(`^${y}${m}(\\d{3})$`);
  let max = 0;
  allSales.forEach(s => {
    const match = s.offerNumber.match(pattern);
    if (match) { const n = parseInt(match[1]); if (n > max) max = n; }
  });
  return `${y}${m}${(max + 1).toString().padStart(3, '0')}`;
}

function getFreezePolicyForPackage(packageType: string): boolean { return packageType !== 'none'; }
function getFreezeLimitForPackage(packageType: string): number {
  return ({ vip: 999, standard: 180, economy: 90 } as any)[packageType] ?? 0;
}
