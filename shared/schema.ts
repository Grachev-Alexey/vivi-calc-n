import { pgTable, text, serial, integer, boolean, timestamp, json, decimal, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users and Authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  pin: varchar("pin", { length: 6 }).notNull().unique(),
  role: text("role").notNull(), // 'master' | 'admin'
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Configuration
export const config = pgTable("config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: json("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Yclients Services Cache
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  yclientsId: integer("yclients_id").notNull().unique(),
  title: text("title").notNull(),
  priceMin: decimal("price_min", { precision: 10, scale: 2 }).notNull(),
  categoryId: integer("category_id"),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Yclients Subscription Types Cache
export const subscriptionTypes = pgTable("subscription_types", {
  id: serial("id").primaryKey(),
  yclientsId: integer("yclients_id").notNull().unique(),
  title: text("title").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  allowFreeze: boolean("allow_freeze").default(false),
  freezeLimit: integer("freeze_limit").default(0),
  balanceContainer: json("balance_container"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Package Configuration
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(), // 'vip' | 'standard' | 'economy'
  name: text("name").notNull(),
  discount: decimal("discount", { precision: 3, scale: 2 }).notNull(), // 0.20 for 20%
  minCost: decimal("min_cost", { precision: 10, scale: 2 }).notNull(),
  minDownPaymentPercent: decimal("min_down_payment_percent", { precision: 3, scale: 2 }).notNull(), // 0.50 for 50%
  requiresFullPayment: boolean("requires_full_payment").default(false),
  giftSessions: integer("gift_sessions").default(0), // Number of free sessions
  bonusAccountPercent: decimal("bonus_account_percent", { precision: 3, scale: 2 }).default('0.00'), // 0.20 for 20%
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Universal Perks (shared across all packages)
export const perks = pgTable("perks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull(), // Lucide icon name
  iconColor: text("icon_color").default("#000000"), // Color for the icon
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Package Perk Values (how each perk applies to each package)
export const packagePerkValues = pgTable("package_perk_values", {
  id: serial("id").primaryKey(),
  packageType: text("package_type").notNull().references(() => packages.type),
  perkId: integer("perk_id").notNull().references(() => perks.id),
  valueType: text("value_type").notNull(), // 'boolean' | 'text' | 'number'
  booleanValue: boolean("boolean_value"), // true/false for included/not included
  textValue: text("text_value"), // "180 дней", "Без ограничений", etc.
  numberValue: decimal("number_value", { precision: 10, scale: 2 }), // numeric values
  displayValue: text("display_value").notNull(), // What to show to user
  tooltip: text("tooltip"), // Tooltip text to show on hover
  customIcon: text("custom_icon"), // Custom icon for this specific package value
  customIconColor: text("custom_icon_color"), // Custom icon color for this specific package value
  isHighlighted: boolean("is_highlighted").default(false), // Special styling
  isBest: boolean("is_best").default(false), // Show "Лучшее" badge
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clients
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: text("email"),
  yclientsId: integer("yclients_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  masterId: integer("master_id").references(() => users.id),
  subscriptionTypeId: integer("subscription_type_id").references(() => subscriptionTypes.id),
  selectedServices: json("selected_services").notNull(), // array of {serviceId, quantity}
  selectedPackage: text("selected_package").notNull(), // 'vip' | 'standard' | 'economy'
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }).notNull(),
  finalCost: decimal("final_cost", { precision: 10, scale: 2 }).notNull(),
  totalSavings: decimal("total_savings", { precision: 10, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 10, scale: 2 }).notNull(),
  installmentMonths: integer("installment_months"),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }),
  appliedDiscounts: json("applied_discounts"), // array of discount details
  freeZones: json("free_zones"), // array of free zone details
  usedCertificate: boolean("used_certificate").default(false),
  manualGiftSessions: json("manual_gift_sessions"),
  saleDate: timestamp("sale_date").defaultNow(), // дата продажи (для админов)
  createdAt: timestamp("created_at").defaultNow(),
});

// Offers
export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  masterId: integer("master_id").references(() => users.id).notNull(),
  saleId: integer("sale_id").references(() => sales.id), // связь с продажей
  offerNumber: text("offer_number").notNull().unique(),
  selectedServices: json("selected_services").notNull(),
  selectedPackage: text("selected_package").notNull(),
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }).notNull(),
  finalCost: decimal("final_cost", { precision: 10, scale: 2 }).notNull(),
  totalSavings: decimal("total_savings", { precision: 10, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 10, scale: 2 }).notNull(),
  installmentMonths: integer("installment_months"),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }),
  paymentSchedule: json("payment_schedule").notNull(), // график платежей
  appliedDiscounts: json("applied_discounts"),
  freeZones: json("free_zones"),
  usedCertificate: boolean("used_certificate").default(false),
  manualGiftSessions: json("manual_gift_sessions"),
  clientName: text("client_name"),
  clientPhone: text("client_phone").notNull(),
  clientEmail: text("client_email"),
  pdfPath: text("pdf_path"), // путь к сгенерированному PDF
  pdfVersion: text("pdf_version").default("standard"), // 'standard' | 'amendment' - версия PDF
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  status: text("status").default("draft"), // draft, sent, accepted, expired
  expiresAt: timestamp("expires_at"), // срок действия предложения
  saleDate: timestamp("sale_date").defaultNow(), // дата продажи (для админов)
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const salesRelations = relations(sales, ({ one, many }) => ({
  client: one(clients, {
    fields: [sales.clientId],
    references: [clients.id],
  }),
  master: one(users, {
    fields: [sales.masterId],
    references: [users.id],
  }),
  subscriptionType: one(subscriptionTypes, {
    fields: [sales.subscriptionTypeId],
    references: [subscriptionTypes.id],
  }),
  offers: many(offers),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  client: one(clients, {
    fields: [offers.clientId],
    references: [clients.id],
  }),
  master: one(users, {
    fields: [offers.masterId],
    references: [users.id],
  }),
  sale: one(sales, {
    fields: [offers.saleId],
    references: [sales.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  sales: many(sales),
  offers: many(offers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  offers: many(offers),
}));

export const packagesRelations = relations(packages, ({ many }) => ({
  perkValues: many(packagePerkValues),
}));

export const perksRelations = relations(perks, ({ many }) => ({
  packageValues: many(packagePerkValues),
}));

export const packagePerkValuesRelations = relations(packagePerkValues, ({ one }) => ({
  package: one(packages, {
    fields: [packagePerkValues.packageType],
    references: [packages.type],
  }),
  perk: one(perks, {
    fields: [packagePerkValues.perkId],
    references: [perks.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertConfigSchema = createInsertSchema(config).omit({ id: true, updatedAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, updatedAt: true });
export const insertSubscriptionTypeSchema = createInsertSchema(subscriptionTypes).omit({ id: true, updatedAt: true });
export const insertPackageSchema = createInsertSchema(packages).omit({ id: true, updatedAt: true });
export const insertPerkSchema = createInsertSchema(perks).omit({ id: true, updatedAt: true });
export const insertPackagePerkValueSchema = createInsertSchema(packagePerkValues).omit({ id: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Config = typeof config.$inferSelect;
export type InsertConfig = z.infer<typeof insertConfigSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type SubscriptionType = typeof subscriptionTypes.$inferSelect;
export type InsertSubscriptionType = z.infer<typeof insertSubscriptionTypeSchema>;
export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Perk = typeof perks.$inferSelect;
export type InsertPerk = z.infer<typeof insertPerkSchema>;
export type PackagePerkValue = typeof packagePerkValues.$inferSelect;
export type InsertPackagePerkValue = z.infer<typeof insertPackagePerkValueSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
