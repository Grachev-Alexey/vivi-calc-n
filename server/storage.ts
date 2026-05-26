import { 
  users, config, services, subscriptionTypes, clients, sales, packages, perks, packagePerkValues, offers,
  type User, type InsertUser, type Config, type InsertConfig,
  type Service, type InsertService, type SubscriptionType, type InsertSubscriptionType,
  type Package, type InsertPackage, type Perk, type InsertPerk,
  type PackagePerkValue, type InsertPackagePerkValue,
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
  updatePackage(id: number, updates: Partial<InsertPackage>): Promise<Package | null>;
  getPackageCount(): Promise<number>;
  
  // Perks
  getPerks(): Promise<Perk[]>;
  createPerk(perk: InsertPerk): Promise<Perk>;
  updatePerk(id: number, updates: Partial<InsertPerk>): Promise<Perk | null>;
  deletePerk(id: number): Promise<void>;
  getPackagePerkValues(): Promise<(PackagePerkValue & { perk: Perk })[]>;
  createPackagePerkValue(perkValue: InsertPackagePerkValue): Promise<PackagePerkValue>;
  updatePackagePerkValue(id: number, updates: Partial<InsertPackagePerkValue>): Promise<PackagePerkValue | null>;
  
  // Package Perks (legacy methods for compatibility)
  getPackagePerks(packageType: string): Promise<any[]>;
  upsertPackagePerk(perkData: any): Promise<any>;
  deletePackagePerk(id: number): Promise<void>;
  
  // Initialization
  initializeDefaultData(): Promise<void>;
  
  // Clients
  getClientByPhone(phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  
  // Sales
  createSale(sale: InsertSale): Promise<Sale>;
  getSalesByMaster(masterId: number): Promise<Sale[]>;
  getSalesStats(): Promise<any>;
  deleteSale(id: number): Promise<void>;
  
  // Offers
  createOffer(offer: InsertOffer): Promise<Offer>;
  getOfferByNumber(offerNumber: string): Promise<Offer | undefined>;
  getOffersByMaster(masterId: number): Promise<Offer[]>;
  getAllOffers(): Promise<Offer[]>;
  updateOffer(id: number, updates: Partial<InsertOffer>): Promise<Offer | null>;
  deleteOffer(id: number): Promise<void>;
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
    // Create a normalized key for comparison based on services
    const serviceKey = services
      .map(s => `${s.serviceId || s.id}:${s.sessionCount || s.count || 10}`)
      .sort()
      .join('|');
    
    console.log('Looking for subscription with service key:', serviceKey);
    console.log('Target cost:', cost);
    
    const subscriptionTypes = await this.getSubscriptionTypes();
    console.log(`Found ${subscriptionTypes.length} existing subscription types`);
    
    const foundSubscription = subscriptionTypes.find(st => {
      // Check cost match first (exact match)
      const costMatch = parseFloat(st.cost.toString()) === cost;
      
      console.log(`Checking subscription "${st.title}" (ID: ${st.id}), cost: ${st.cost}, match: ${costMatch}`);
      
      if (!costMatch) return false;
      
      // Extract services from balanceContainer
      const balanceContainer = st.balanceContainer as any;
      if (!balanceContainer || !balanceContainer.links || !Array.isArray(balanceContainer.links)) {
        console.log('  No valid balance container');
        return false;
      }
      
      // Create service key from balance container
      const stServiceKey = balanceContainer.links
        .map((link: any) => `${link.service?.id || link.service_id}:${link.count}`)
        .sort()
        .join('|');
      
      console.log(`  Existing subscription service key: ${stServiceKey}`);
      console.log(`  Looking for service key: ${serviceKey}`);
      
      console.log(`  Service key: ${stServiceKey}, target: ${serviceKey}, match: ${stServiceKey === serviceKey}`);
      
      return stServiceKey === serviceKey;
    });
    
    if (foundSubscription) {
      console.log('Found matching subscription:', foundSubscription.title);
    } else {
      console.log('No matching subscription found');
    }
    
    return foundSubscription;
  }

  async findSubscriptionByNumber(number: string): Promise<SubscriptionType | undefined> {
    const subscriptionTypes = await this.getSubscriptionTypes();
    return subscriptionTypes.find(st => st.title?.startsWith(number));
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

  async getSalesByMaster(masterId: number): Promise<Sale[]> {
    return await db.select().from(sales).where(eq(sales.masterId, masterId));
  }

  async getSalesStats(): Promise<any> {
    const salesData = await db.select({
      id: sales.id,
      clientName: sql<string | null>`null`, // clients table doesn't have name field
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
      correctionPercent: sql<number | null>`null` // Will get from appliedDiscounts
    })
    .from(sales)
    .leftJoin(clients, eq(sales.clientId, clients.id))
    .leftJoin(users, eq(sales.masterId, users.id))
    .leftJoin(subscriptionTypes, eq(sales.subscriptionTypeId, subscriptionTypes.id))

    .orderBy(desc(sales.createdAt));

    // Calculate summary statistics
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + parseFloat(sale.finalCost || '0'), 0);
    const totalSavingsGiven = salesData.reduce((sum, sale) => sum + parseFloat(sale.totalSavings || '0'), 0);
    
    // Group by package type
    const packageStats = salesData.reduce((acc, sale) => {
      const pkg = sale.selectedPackage || 'unknown';
      if (!acc[pkg]) {
        acc[pkg] = { count: 0, revenue: 0 };
      }
      acc[pkg].count++;
      acc[pkg].revenue += parseFloat(sale.finalCost || '0');
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    // Group by master
    const masterStats = salesData.reduce((acc, sale) => {
      const master = sale.masterName || 'Неизвестен';
      if (!acc[master]) {
        acc[master] = { count: 0, revenue: 0 };
      }
      acc[master].count++;
      acc[master].revenue += parseFloat(sale.finalCost || '0');
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    return {
      sales: salesData,
      summary: {
        totalSales,
        totalRevenue,
        totalSavingsGiven,
        packageStats,
        masterStats
      }
    };
  }

  async deleteSale(id: number): Promise<void> {
    // Сначала удаляем все связанные оферты
    await db.delete(offers).where(eq(offers.saleId, id));
    
    // Затем удаляем саму продажу
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

  async updatePackage(id: number, updates: Partial<InsertPackage>): Promise<Package | null> {
    const [updated] = await db.update(packages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(packages.id, id))
      .returning();
    return updated || null;
  }

  async createOrUpdatePackage(pkg: InsertPackage): Promise<Package> {
    
    const result = await this.upsertPackage(pkg);
    
    return result;
  }

  // Universal Perks
  async getPerks(): Promise<Perk[]> {
    return await db.select().from(perks)
      .where(eq(perks.isActive, true))
      .orderBy(perks.displayOrder, perks.id);
  }

  async createPerk(perk: InsertPerk): Promise<Perk> {
    const [newPerk] = await db.insert(perks).values(perk).returning();
    return newPerk;
  }

  async updatePerk(id: number, updates: Partial<InsertPerk>): Promise<Perk | null> {
    const [updated] = await db.update(perks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(perks.id, id))
      .returning();
    return updated || null;
  }

  async getPackagePerkValues(): Promise<(PackagePerkValue & { perk: Perk })[]> {
    return await db.select({
      id: packagePerkValues.id,
      packageType: packagePerkValues.packageType,
      perkId: packagePerkValues.perkId,
      valueType: packagePerkValues.valueType,
      booleanValue: packagePerkValues.booleanValue,
      textValue: packagePerkValues.textValue,
      numberValue: packagePerkValues.numberValue,
      displayValue: packagePerkValues.displayValue,
      tooltip: packagePerkValues.tooltip,
      customIcon: packagePerkValues.customIcon,
      customIconColor: packagePerkValues.customIconColor,
      isHighlighted: packagePerkValues.isHighlighted,
      isBest: packagePerkValues.isBest,
      isActive: packagePerkValues.isActive,
      updatedAt: packagePerkValues.updatedAt,
      perk: {
        id: perks.id,
        name: perks.name,
        description: perks.description,
        icon: perks.icon,
        iconColor: perks.iconColor,
        displayOrder: perks.displayOrder,
        isActive: perks.isActive,
        updatedAt: perks.updatedAt,
      }
    })
    .from(packagePerkValues)
    .innerJoin(perks, eq(packagePerkValues.perkId, perks.id))
    .where(and(eq(packagePerkValues.isActive, true), eq(perks.isActive, true)))
    .orderBy(perks.displayOrder, perks.id);
  }

  async createPackagePerkValue(perkValue: InsertPackagePerkValue): Promise<PackagePerkValue> {
    const [newPerkValue] = await db.insert(packagePerkValues).values(perkValue).returning();
    return newPerkValue;
  }

  async deletePerk(perkId: number): Promise<void> {
    // First delete all perk values for this perk
    await db.delete(packagePerkValues).where(eq(packagePerkValues.perkId, perkId));
    // Then delete the perk itself
    await db.delete(perks).where(eq(perks.id, perkId));
  }

  async updatePackagePerkValue(id: number, updates: Partial<InsertPackagePerkValue>): Promise<PackagePerkValue | null> {
    
    // Clean up the updates object
    const cleanUpdates = {
      ...updates,
      tooltip: updates.tooltip === '' ? null : updates.tooltip,
      customIcon: updates.customIcon === 'none' ? null : updates.customIcon,
      customIconColor: updates.customIconColor === '' ? null : updates.customIconColor,
      updatedAt: new Date()
    };
    
    
    const [updated] = await db.update(packagePerkValues)
      .set(cleanUpdates)
      .where(eq(packagePerkValues.id, id))
      .returning();
    
    return updated || null;
  }

  // Legacy methods for package perks compatibility
  async getPackagePerks(packageType: string): Promise<any[]> {
    // Return package perk values for specific package type
    const perkValues = await this.getPackagePerkValues();
    return perkValues.filter(pv => pv.packageType === packageType);
  }

  async upsertPackagePerk(perkData: any): Promise<any> {
    // Create or update package perk value
    if (perkData.id) {
      return await this.updatePackagePerkValue(perkData.id, perkData);
    } else {
      return await this.createPackagePerkValue(perkData);
    }
  }

  async deletePackagePerk(id: number): Promise<void> {
    // Delete package perk value
    await db.delete(packagePerkValues).where(eq(packagePerkValues.id, id));
  }

  async getPackageCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(packages);
    return Number(result[0].count);
  }

  async initializeDefaultData(): Promise<void> {
    // Check if we need to create default admin user
    const userCount = await this.getUserCount();
    if (userCount === 0) {
      await this.createUser({
        pin: "7571",
        role: "admin",
        name: "Администратор",
        isActive: true
      });
    }

    // Check if we need to create default packages
    const packageCount = await this.getPackageCount();
    if (packageCount === 0) {
      // Create VIP package
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

      // Create Standard package
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

      // Create Economy package
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

  async getOfferByNumber(offerNumber: string): Promise<Offer | undefined> {
    const [offer] = await db.select().from(offers).where(eq(offers.offerNumber, offerNumber));
    return offer || undefined;
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

  async deleteOffer(id: number): Promise<void> {
    await db.delete(offers).where(eq(offers.id, id));
  }
}

export const storage = new DatabaseStorage();
