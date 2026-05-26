import { 
  users, config, services, subscriptionTypes, clients, sales, packages, perks, packagePerkValues, offers,
  type User, type InsertUser, type Config, type InsertConfig,
  type Service, type InsertService, type SubscriptionType, type InsertSubscriptionType,
  type Package, type InsertPackage,
  type Client, type InsertClient, type Sale, type InsertSale,
  type Offer, type InsertOffer
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";

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
  upsertSubscriptionType(subscriptionType: InsertSubscriptionType): Promise<SubscriptionType>;
  findSubscriptionType(services: any[], cost: number, packageType: string): Promise<SubscriptionType | undefined>;
  findSubscriptionByNumber(number: string): Promise<SubscriptionType | undefined>;
  
  // Packages
  getPackages(): Promise<Package[]>;
  upsertPackage(pkg: InsertPackage): Promise<Package>;
  getPackageCount(): Promise<number>;
  
  // Initialization
  initializeDefaultData(): Promise<void>;
  
  // Clients
  getClientByPhone(phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  
  // Sales
  createSale(sale: InsertSale): Promise<Sale>;
  deleteSale(id: number): Promise<void>;
  
  // Offers
  createOffer(offer: InsertOffer): Promise<Offer>;
  getOffersByMaster(masterId: number): Promise<Offer[]>;
  getAllOffers(): Promise<Offer[]>;
  updateOffer(id: number, updates: Partial<InsertOffer>): Promise<Offer | null>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUserByPin(pin: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.pin, pin));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(users);
    return Number(result[0].count);
  }

  // Config
  async getConfig(key: string): Promise<Config | undefined> {
    const [configItem] = await db.select().from(config).where(eq(config.key, key));
    return configItem || undefined;
  }

  async setConfig(key: string, value: any): Promise<Config> {
    const [configItem] = await db
      .insert(config)
      .values({ key, value })
      .onConflictDoUpdate({
        target: config.key,
        set: { value, updatedAt: new Date() }
      })
      .returning();
    return configItem;
  }

  // Services
  async getActiveServices(): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.isActive, true));
  }

  async getAllServices(): Promise<Service[]> {
    return await db.select().from(services);
  }

  async upsertService(service: InsertService): Promise<Service> {
    const [serviceItem] = await db
      .insert(services)
      .values(service)
      .onConflictDoUpdate({
        target: services.yclientsId,
        set: { ...service, updatedAt: new Date() }
      })
      .returning();
    return serviceItem;
  }

  async updateServiceStatus(yclientsId: number, isActive: boolean): Promise<void> {
    await db.update(services)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(services.yclientsId, yclientsId));
  }

  // Subscription Types
  async getSubscriptionTypes(): Promise<SubscriptionType[]> {
    return await db.select().from(subscriptionTypes);
  }

  async upsertSubscriptionType(subscriptionType: InsertSubscriptionType): Promise<SubscriptionType> {
    const [subscriptionTypeItem] = await db
      .insert(subscriptionTypes)
      .values(subscriptionType)
      .onConflictDoUpdate({
        target: subscriptionTypes.yclientsId,
        set: { ...subscriptionType, updatedAt: new Date() }
      })
      .returning();
    return subscriptionTypeItem;
  }

  async findSubscriptionType(services: any[], cost: number, packageType: string): Promise<SubscriptionType | undefined> {
    const serviceKey = services
      .map(s => `${s.serviceId || s.id}:${s.sessionCount || s.count || 10}`)
      .sort()
      .join('|');
    
    const allSubscriptionTypes = await this.getSubscriptionTypes();
    
    return allSubscriptionTypes.find(st => {
      const costMatch = parseFloat(st.cost.toString()) === cost;
      if (!costMatch) return false;
      
      const balanceContainer = st.balanceContainer as any;
      if (!balanceContainer || !balanceContainer.links || !Array.isArray(balanceContainer.links)) return false;
      
      const stServiceKey = balanceContainer.links
        .map((link: any) => `${link.service?.id || link.service_id}:${link.count}`)
        .sort()
        .join('|');
      
      return stServiceKey === serviceKey;
    });
  }

  async findSubscriptionByNumber(number: string): Promise<SubscriptionType | undefined> {
    const allSubscriptionTypes = await this.getSubscriptionTypes();
    return allSubscriptionTypes.find(st => st.title?.startsWith(number));
  }

  // Clients
  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.phone, phone));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [clientItem] = await db.insert(clients).values(client).returning();
    return clientItem;
  }

  // Sales
  async createSale(sale: InsertSale): Promise<Sale> {
    const [saleItem] = await db.insert(sales).values(sale).returning();
    return saleItem;
  }

  async deleteSale(id: number): Promise<void> {
    await db.delete(offers).where(eq(offers.saleId, id));
    await db.delete(sales).where(eq(sales.id, id));
  }

  // Packages
  async getPackages(): Promise<Package[]> {
    return await db.select().from(packages).where(eq(packages.isActive, true));
  }

  async upsertPackage(pkg: InsertPackage): Promise<Package> {
    const [existing] = await db.select().from(packages).where(eq(packages.type, pkg.type));
    if (existing) {
      const [updated] = await db.update(packages)
        .set({ ...pkg, updatedAt: new Date() })
        .where(eq(packages.type, pkg.type))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(packages).values(pkg).returning();
      return created;
    }
  }

  async getPackageCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(packages);
    return Number(result[0].count);
  }

  async initializeDefaultData(): Promise<void> {
    const userCount = await this.getUserCount();
    if (userCount === 0) {
      await this.createUser({
        pin: "7571",
        role: "admin",
        name: "Администратор",
        isActive: true
      });
    }

    const packageCount = await this.getPackageCount();
    if (packageCount === 0) {
      await this.upsertPackage({
        type: "vip",
        name: "VIP",
        discount: "0.30",
        minCost: "25000",
        minDownPaymentPercent: "1.00",
        requiresFullPayment: true,
        giftSessions: 3,
        isActive: true
      });

      await this.upsertPackage({
        type: "standard",
        name: "Стандарт",
        discount: "0.25",
        minCost: "30000",
        minDownPaymentPercent: "0.50",
        requiresFullPayment: false,
        giftSessions: 1,
        isActive: true
      });

      await this.upsertPackage({
        type: "economy",
        name: "Эконом",
        discount: "0.20",
        minCost: "10000",
        minDownPaymentPercent: "0.01",
        requiresFullPayment: false,
        giftSessions: 0,
        isActive: true
      });
    }
  }

  // Offers
  async createOffer(offer: InsertOffer): Promise<Offer> {
    const [createdOffer] = await db.insert(offers).values(offer).returning();
    return createdOffer;
  }

  async getOffersByMaster(masterId: number): Promise<Offer[]> {
    return await db.select().from(offers).where(eq(offers.masterId, masterId)).orderBy(desc(offers.createdAt));
  }

  async getAllOffers(): Promise<Offer[]> {
    return await db.select().from(offers).orderBy(desc(offers.createdAt));
  }

  async updateOffer(id: number, updates: Partial<InsertOffer>): Promise<Offer | null> {
    const [updatedOffer] = await db.update(offers).set(updates).where(eq(offers.id, id)).returning();
    return updatedOffer || null;
  }
}

export const storage = new DatabaseStorage();
