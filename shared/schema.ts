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
  discount: decimal("discount", { precision: 3, scale: 2 }).notNull(),
  minCost: decimal("min_cost", { precision: 10, scale: 2 }).notNull(),
  minDownPaymentPercent: decimal("min_down_payment_percent", { precision: 3, scale: 2 }).notNull(),
  requiresFullPayment: boolean("requires_full_payment").default(false),
  giftSessions: integer("gift_sessions").default(0),
  bonusAccountPercent: decimal("bonus_account_percent", { precision: 3, scale: 2 }).default('0.00'),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales (merged with offer/contract data)
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  masterId: integer("master_id").references(() => users.id).notNull(),
  subscriptionTypeId: integer("subscription_type_id").references(() => subscriptionTypes.id),

  // Offer number (e.g. 2605001)
  offerNumber: text("offer_number").notNull().unique(),

  // Client info (denormalized — no separate clients table)
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientEmail: text("client_email"),

  // Calculation data
  selectedServices: json("selected_services").notNull(),
  selectedPackage: text("selected_package").notNull(),
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }).notNull(),
  finalCost: decimal("final_cost", { precision: 10, scale: 2 }).notNull(),
  totalSavings: decimal("total_savings", { precision: 10, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 10, scale: 2 }).notNull(),
  installmentMonths: integer("installment_months"),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }),
  paymentSchedule: json("payment_schedule"),
  appliedDiscounts: json("applied_discounts"),
  freeZones: json("free_zones"),
  usedCertificate: boolean("used_certificate").default(false),
  manualGiftSessions: json("manual_gift_sessions"),

  // PDF / contract
  pdfPath: text("pdf_path"),
  pdfVersion: text("pdf_version").default("standard"),

  // Email delivery
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),

  // Status
  status: text("status").default("draft"),

  saleDate: timestamp("sale_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const salesRelations = relations(sales, ({ one }) => ({
  master: one(users, { fields: [sales.masterId], references: [users.id] }),
  subscriptionType: one(subscriptionTypes, { fields: [sales.subscriptionTypeId], references: [subscriptionTypes.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertConfigSchema = createInsertSchema(config).omit({ id: true, updatedAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, updatedAt: true });
export const insertSubscriptionTypeSchema = createInsertSchema(subscriptionTypes).omit({ id: true, updatedAt: true });
export const insertPackageSchema = createInsertSchema(packages).omit({ id: true, updatedAt: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });

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
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
