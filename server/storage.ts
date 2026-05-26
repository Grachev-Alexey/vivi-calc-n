import {
  users, config, services, subscriptionTypes, packages, sales,
  type User, type InsertUser, type Config,
  type Service, type InsertService, type SubscriptionType, type InsertSubscriptionType,
  type Package, type InsertPackage,
  type Sale, type InsertSale
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByPin(pin: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  getUserCount(): Promise<number>;

  // Config
  getConfig(key: string): Promise<Config | undefined>;
  setConfig(key: string, value: any): Promise<Config>;

  // Services
  getActiveServices(): Promise<Service[]>;
  getAllServices(): Promise<Service[]>;
  upsertService(service: InsertService): Promise<Service>;
  updateServiceStatus(yclientsId: number, isActive: boolean): Promise<void>;

  // Subscription Types
  getSubscriptionTypes(): Promise<SubscriptionType[]>;
  upsertSubscriptionType(st: InsertSubscriptionType): Promise<SubscriptionType>;
  findSubscriptionType(services: any[], cost: number, packageType: string): Promise<SubscriptionType | undefined>;
  findSubscriptionByNumber(number: string): Promise<SubscriptionType | undefined>;

  // Packages
  getPackages(): Promise<Package[]>;
  upsertPackage(pkg: InsertPackage): Promise<Package>;
  getPackageCount(): Promise<number>;

  // Sales
  createSale(sale: InsertSale): Promise<Sale>;
  getSaleById(id: number): Promise<Sale | undefined>;
  updateSale(id: number, updates: Partial<InsertSale>): Promise<Sale | undefined>;
  deleteSale(id: number): Promise<void>;
  getAllSales(): Promise<Sale[]>;
  getMasterSales(masterId: number): Promise<Sale[]>;

  // Init
  initializeDefaultData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ── Users ────────────────────────────────────────────────────────────

  async getUserByPin(pin: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.pin, pin));
    return u;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(u: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(u).returning();
    return created;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserCount(): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(count);
  }

  // ── Config ───────────────────────────────────────────────────────────

  async getConfig(key: string): Promise<Config | undefined> {
    const [c] = await db.select().from(config).where(eq(config.key, key));
    return c;
  }

  async setConfig(key: string, value: any): Promise<Config> {
    const [c] = await db
      .insert(config)
      .values({ key, value })
      .onConflictDoUpdate({ target: config.key, set: { value, updatedAt: new Date() } })
      .returning();
    return c;
  }

  // ── Services ─────────────────────────────────────────────────────────

  async getActiveServices(): Promise<Service[]> {
    return db.select().from(services).where(eq(services.isActive, true));
  }

  async getAllServices(): Promise<Service[]> {
    return db.select().from(services);
  }

  async upsertService(service: InsertService): Promise<Service> {
    const [s] = await db
      .insert(services)
      .values(service)
      .onConflictDoUpdate({ target: services.yclientsId, set: { ...service, updatedAt: new Date() } })
      .returning();
    return s;
  }

  async updateServiceStatus(yclientsId: number, isActive: boolean): Promise<void> {
    await db.update(services).set({ isActive, updatedAt: new Date() }).where(eq(services.yclientsId, yclientsId));
  }

  // ── Subscription Types ───────────────────────────────────────────────

  async getSubscriptionTypes(): Promise<SubscriptionType[]> {
    return db.select().from(subscriptionTypes);
  }

  async upsertSubscriptionType(st: InsertSubscriptionType): Promise<SubscriptionType> {
    const [item] = await db
      .insert(subscriptionTypes)
      .values(st)
      .onConflictDoUpdate({ target: subscriptionTypes.yclientsId, set: { ...st, updatedAt: new Date() } })
      .returning();
    return item;
  }

  async findSubscriptionType(servicesList: any[], cost: number, _packageType: string): Promise<SubscriptionType | undefined> {
    const key = servicesList
      .map(s => `${s.serviceId ?? s.id}:${s.sessionCount ?? s.count ?? 10}`)
      .sort()
      .join('|');

    const all = await this.getSubscriptionTypes();
    return all.find(st => {
      if (parseFloat(st.cost.toString()) !== cost) return false;
      const bc = st.balanceContainer as any;
      if (!bc?.links?.length) return false;
      const stKey = bc.links
        .map((l: any) => `${l.service?.id ?? l.service_id}:${l.count}`)
        .sort()
        .join('|');
      return stKey === key;
    });
  }

  async findSubscriptionByNumber(number: string): Promise<SubscriptionType | undefined> {
    const all = await this.getSubscriptionTypes();
    return all.find(st => st.title?.startsWith(number));
  }

  // ── Packages ─────────────────────────────────────────────────────────

  async getPackages(): Promise<Package[]> {
    return db.select().from(packages).where(eq(packages.isActive, true));
  }

  async upsertPackage(pkg: InsertPackage): Promise<Package> {
    const [existing] = await db.select().from(packages).where(eq(packages.type, pkg.type));
    if (existing) {
      const [updated] = await db.update(packages)
        .set({ ...pkg, updatedAt: new Date() })
        .where(eq(packages.type, pkg.type))
        .returning();
      return updated;
    }
    const [created] = await db.insert(packages).values(pkg).returning();
    return created;
  }

  async getPackageCount(): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(packages);
    return Number(count);
  }

  // ── Sales ────────────────────────────────────────────────────────────

  async createSale(sale: InsertSale): Promise<Sale> {
    const [created] = await db.insert(sales).values(sale).returning();
    return created;
  }

  async getSaleById(id: number): Promise<Sale | undefined> {
    const [s] = await db.select().from(sales).where(eq(sales.id, id));
    return s;
  }

  async updateSale(id: number, updates: Partial<InsertSale>): Promise<Sale | undefined> {
    const [updated] = await db.update(sales).set(updates).where(eq(sales.id, id)).returning();
    return updated;
  }

  async deleteSale(id: number): Promise<void> {
    await db.delete(sales).where(eq(sales.id, id));
  }

  async getAllSales(): Promise<Sale[]> {
    return db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getMasterSales(masterId: number): Promise<Sale[]> {
    return db.select().from(sales).where(eq(sales.masterId, masterId)).orderBy(desc(sales.createdAt));
  }

  // ── Init ─────────────────────────────────────────────────────────────

  async initializeDefaultData(): Promise<void> {
    if ((await this.getUserCount()) === 0) {
      await this.createUser({ pin: "7571", role: "admin", name: "Администратор", isActive: true });
    }

    if ((await this.getPackageCount()) === 0) {
      await this.upsertPackage({ type: "vip",      name: "VIP",      discount: "0.30", minCost: "25000", minDownPaymentPercent: "1.00", requiresFullPayment: true,  giftSessions: 3, isActive: true });
      await this.upsertPackage({ type: "standard", name: "Стандарт", discount: "0.25", minCost: "30000", minDownPaymentPercent: "0.50", requiresFullPayment: false, giftSessions: 1, isActive: true });
      await this.upsertPackage({ type: "economy",  name: "Эконом",   discount: "0.20", minCost: "10000", minDownPaymentPercent: "0.01", requiresFullPayment: false, giftSessions: 0, isActive: true });
    }
  }
}

export const storage = new DatabaseStorage();
