import puppeteer from "puppeteer";
import { Offer } from "@shared/schema";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { execSync } from "child_process";

interface PaymentScheduleItem {
    date: string;
    amount: number;
    description: string;
}

export class PDFGenerator {
    constructor(private storage?: any) {}

    async generateOfferPDF(offer: Offer, packageData?: any): Promise<Buffer> {
        console.log('PDF Generator - Input data:', {
            offerNumber: offer.offerNumber,
            selectedPackage: offer.selectedPackage,
            manualGiftSessions: offer.manualGiftSessions,
            selectedServices: offer.selectedServices,
            packageData
        });
        
        let executablePath;
        try {
            executablePath = execSync("which chromium", {
                encoding: "utf8",
            }).trim();
        } catch (error) {
            console.log("Chromium not found, using default");
            executablePath = undefined;
        }

        const browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-web-security",
                "--disable-features=VizDisplayCompositor",
                "--run-all-compositor-stages-before-draw",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
                "--disable-backgrounding-occluded-windows",
                "--disable-ipc-flooding-protection",
            ],
        });

        try {
            const page = await browser.newPage();

            const htmlContent = await this.generateOfferHTML(
                offer,
                packageData,
            );
            await page.setContent(htmlContent, { waitUntil: "networkidle0" });

            const pdfBuffer = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: {
                    top: "20mm",
                    bottom: "20mm",
                    left: "15mm",
                    right: "15mm",
                },
            });

            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }

    private getServiceNames(selectedServices: any[]): string {
        if (!selectedServices || selectedServices.length === 0) {
            return "Не указаны";
        }
        
        return selectedServices.map(service => {
            const title = service.title || service.name || 'Услуга';
            const sessionCount = service.sessionCount || service.count || 10;
            return `${title} (${sessionCount} сеансов)`;
        }).join(", ");
    }

    private getTotalSessions(selectedServices: any[]): number {
        // Возвращаем максимальное количество сеансов среди всех услуг
        if (!selectedServices || selectedServices.length === 0) {
            return 0;
        }
        
        const sessionCounts = selectedServices.map(service => {
            const sessionCount = service.sessionCount || service.count || service.quantity || 10;
            return sessionCount;
        });
        
        return Math.max(...sessionCounts);
    }

    private getGiftSessions(packageType: string): number {
        // This method is now deprecated as gift sessions come from offer data
        return 0;
    }

    private getBonusPercent(packageType: string): number {
        switch (packageType) {
            case "vip":
                return 20;
            case "standard":
                return 15;
            case "economy":
                return 10;
            default:
                return 0;
        }
    }

    private getPackageDiscount(packageType: string): number {
        switch (packageType) {
            case "vip":
                return 30;
            case "standard":
                return 25;
            case "economy":
                return 20;
            default:
                return 0;
        }
    }

    private getPackagePerks(packageType: string): any {
        switch (packageType) {
            case "vip":
                return {
                    massage:
                        "Курс массажа вокруг глаз на аппарате Bork D617 - 10 сеансов",
                    hasCard: true,
                    card: "Золотая карта",
                    cardDiscount: "35",
                    freezeOption: "Бессрочно",
                };
            case "standard":
                return {
                    massage:
                        "Курс массажа вокруг глаз на аппарате Bork D617 - 5 сеансов",
                    hasCard: true,
                    card: "Серебряная карта",
                    cardDiscount: "30",
                    freezeOption: "6 мес",
                };
            case "economy":
                return {
                    massage:
                        "Курс массажа вокруг глаз на аппарате Bork D617 - 3 сеанса",
                    hasCard: false,
                    card: "",
                    cardDiscount: "",
                    freezeOption: "3 мес",
                };
            default:
                return {
                    massage:
                        "Курс массажа вокруг глаз на аппарате Bork D617 - 3 сеанса",
                    hasCard: false,
                    card: "",
                    cardDiscount: "",
                    freezeOption: "3 мес",
                };
        }
    }

    private async generateOfferHTML(
        offer: Offer,
        packageData?: any,
    ): Promise<string> {
        const selectedServices = offer.selectedServices as any[];
        const packagePerks = this.getPackagePerks(offer.selectedPackage);
        // Calculate actual discount from offer data instead of package settings
        const baseCost = parseFloat(offer.baseCost.toString());
        const finalCost = parseFloat(offer.finalCost.toString());
        const actualDiscountPercentage = baseCost > 0 
            ? Math.round(((baseCost - finalCost) / baseCost) * 100)
            : 0;
        console.log('PDF generation data:', {
            packageData,
            selectedPackage: offer.selectedPackage,
            giftSessionsFromData: packageData?.giftSessions,
            bonusPercentFromData: packageData?.bonusAccountPercent,
            manualGiftSessions: offer.manualGiftSessions
        });

        // Use manual gift sessions if available, otherwise use package default
        let giftSessions = 0;
        const manualGiftSessions = offer.manualGiftSessions as any;
        if (manualGiftSessions && typeof manualGiftSessions === 'object' && manualGiftSessions[offer.selectedPackage] !== undefined) {
            giftSessions = manualGiftSessions[offer.selectedPackage];
        } else if (packageData && packageData.giftSessions !== undefined) {
            giftSessions = packageData.giftSessions;
        } else {
            // Fallback to old logic for backward compatibility
            giftSessions = this.getGiftSessions(offer.selectedPackage);
        }
        
        const bonusPercent = packageData && packageData.bonusAccountPercent !== undefined
            ? Math.round(parseFloat(packageData.bonusAccountPercent.toString()) * 100)
            : this.getBonusPercent(offer.selectedPackage);

        console.log('PDF generation - Gift sessions calculation:', { 
            selectedPackage: offer.selectedPackage,
            manualGiftSessions: offer.manualGiftSessions,
            packageDataGiftSessions: packageData?.giftSessions,
            finalGiftSessions: giftSessions,
            bonusPercent 
        });
        
        const paymentSchedule = offer.paymentSchedule as PaymentScheduleItem[];
        const pdfVersion = (offer as any).pdfVersion || 'standard';
        const isAmendment = pdfVersion === 'amendment';

        return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isAmendment ? 'Изменение условий договора' : 'Приложение №1 к договору-оферте'}</title>
    <style>
        @page { 
            margin: 15mm; 
            size: A4; 
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            margin: 0;
            padding: 10mm;
            color: #000;
        }
        .title {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .amendment-notice {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            color: #D9534F;
            margin-bottom: 20px;
            padding: 10px;
            border: 2px solid #D9534F;
            background-color: #FFE6E6;
        }
        .subtitle {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .section {
            margin-bottom: 12px;
        }
        .service-name {
            margin-bottom: 8px;
        }
        .details {
            margin-bottom: 8px;
        }
        .perks-list {
            margin-left: 15px;
            margin-bottom: 8px;
        }
        .perks-list li {
            margin-bottom: 3px;
        }
        .cost-section {
            margin-top: 20px;
            margin-bottom: 15px;
        }
        .cost-item {
            margin-bottom: 4px;
        }
        .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            background-color: #FFE6E6;
        }
        .payment-table th,
        .payment-table td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: center;
        }
        .payment-table th {
            background-color: #FFB3B3;
            font-weight: bold;
        }
        .payment-schedule-title {
            text-align: center;
            font-weight: bold;
            margin: 20px 0 10px 0;
        }
        .footer-note {
            margin-top: 25px;
            font-size: 10pt;
            font-weight: bold;
        }
        .highlight {
            color: #4472C4;
            font-weight: bold;
        }
        .card-info {
            color: #4472C4;
            font-weight: bold;
        }
    </style>
</head>
<body>
    ${isAmendment ? `
    <div class="amendment-notice">
        ⚠️ ИЗМЕНЕНИЕ УСЛОВИЙ ДОГОВОРА ⚠️
    </div>
    <div class="title">
        Дополнительное соглашение об изменении условий к договору-оферте на оказание услуг по системе абонементов в студиях аппаратной косметологии «Виви»
    </div>
    ` : `
    <div class="title">
        Приложение № 1 к договору-оферте на оказание услуг по системе абонементов в студиях аппаратной косметологии «Виви» (Текст договора-оферты размещен на vivilaser.ru)
    </div>
    `}

    <div class="subtitle">
        Стороны договорились о следующих услугах, входящих в Абонемент
    </div>

    <div class="section">
        <div class="service-name">1. Наименование услуги "<span class="highlight">${this.getServiceNames(selectedServices)}</span>"</div>
    </div>

    <div class="section">
        <div class="details">2. Количество сеансов: <span class="highlight">${this.getTotalSessions(selectedServices)}</span></div>
    </div>

    <div class="section">
        <div class="details">2. Индивидуальная скидка от стоимости прайса-листа: <span class="highlight">${actualDiscountPercentage}%</span></div>
    </div>

    <div class="section">
        <div class="details">3. Право на подарки:</div>
        <ul class="perks-list">
            <li>за приглашение подруг - 1 зона за каждую подругу;</li>
            <li>отзывы на Яндекс.Карты и 2ГИС - 1 зона за каждый честный отзыв;</li>
            <li>за рекомендации в соцсетях - 1 зона за упоминание в соцсетях.</li>
        </ul>
    </div>

    <div class="section">
        <div class="details">4. Курс массажа вокруг глаз на аппарате Bork D617 - <span class="highlight">${this.getTotalSessions(selectedServices)}</span> сеансов</div>
    </div>

    ${
        packagePerks.hasCard
            ? `
    <div class="section">
        <div class="details">5. <span class="card-info">${packagePerks.card}</span>, дающая скидку навсегда в размере <span class="highlight">${packagePerks.cardDiscount}%</span> на</div>
        <ul class="perks-list">
            <li>поддерживающие процедуры выбранных зон во всех студиях сети «Виви»</li>
        </ul>
    </div>
    `
            : ""
    }

    ${
        offer.selectedPackage !== "economy" 
            ? `
    <div class="section">
        <div class="details">${packagePerks.hasCard ? "6" : "5"}. Количество дополнительных подарочных сеансов: <span class="highlight">${giftSessions}</span></div>
    </div>
    `
            : ""
    }

    <div class="section">
        <div class="details">${offer.selectedPackage === "economy" ? (packagePerks.hasCard ? "6" : "5") : (packagePerks.hasCard ? "7" : "6")}. Возможность заморозки карты: <span class="highlight">${packagePerks.freezeOption}</span></div>
    </div>

    ${
        offer.selectedPackage !== "economy" 
            ? `
    <div class="section">
        <div class="details">${packagePerks.hasCard ? "8" : "7"}. Начисление на бонусный счет: <span class="highlight">${bonusPercent}%</span> от стоимости абонемента</div>
    </div>
    `
            : ""
    }

    <div class="cost-section">
        <div class="cost-item">Стоимость абонемента: <span class="highlight">${this.formatAmount(offer.finalCost)} руб.</span></div>
        <div class="cost-item">Первоначальный взнос: <span class="highlight">${this.formatAmount(offer.downPayment)} руб.</span></div>
        ${
            offer.installmentMonths && offer.installmentMonths > 1
                ? `
            <div class="cost-item">Размер платежа: <span class="highlight">${this.formatAmount(offer.monthlyPayment || 0)} руб.</span></div>
            <div class="cost-item">Количество платежей: <span class="highlight">${offer.installmentMonths}</span></div>
        `
                : ""
        }
    </div>

    ${
        paymentSchedule && paymentSchedule.length > 0
            ? `
    <div class="payment-schedule-title">График платежей</div>
    <table class="payment-table">
        <thead>
            <tr>
                <th>Дата платежа</th>
                <th>Сумма платежа</th>
            </tr>
        </thead>
        <tbody>
            ${paymentSchedule
                .map(
                    (payment) => `
                <tr>
                    <td>${payment.date}</td>
                    <td>${this.formatAmount(payment.amount)} руб.</td>
                </tr>
            `,
                )
                .join("")}
        </tbody>
    </table>
    `
            : ""
    }

    <div class="footer-note">
        Условия действуют только при своевременной оплате. При просрочке платежа более чем на 5 дней стоимость посещения пересчитывается по стандартному прайсу и дополнительные условия (скидки, пакеты, бонусы и привилегии) аннулируются.
    </div>

    <div class="section" style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px;">
        <div class="details"><strong>Данные клиента:</strong></div>
        <div class="details">ФИО: <span class="highlight">${offer.clientName || "Не указано"}</span></div>
        <div class="details">Телефон: <span class="highlight">${offer.clientPhone || "Не указан"}</span></div>
        <div class="details">Email: <span class="highlight">${offer.clientEmail || "Не указан"}</span></div>
        <div class="details">Дата: <span class="highlight">${format(new Date(), "dd.MM.yyyy", { locale: ru })}</span></div>
    </div>
</body>
</html>
    `;
    }

    private getPackageName(packageType: string): string {
        switch (packageType) {
            case "vip":
                return "VIP (максимальная скидка)";
            case "standard":
                return "Стандарт (средняя скидка)";
            case "economy":
                return "Эконом (базовая скидка)";
            default:
                return packageType;
        }
    }

    private formatAmount(amount: string | number): string {
        const num = typeof amount === "string" ? parseFloat(amount) : amount;
        return new Intl.NumberFormat("ru-RU").format(num);
    }
}

export const pdfGenerator = new PDFGenerator();