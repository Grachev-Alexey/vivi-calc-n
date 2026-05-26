import puppeteer from "puppeteer";
import { Sale } from "@shared/schema";
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

    async generateOfferPDF(sale: Sale, packageData?: any): Promise<Buffer> {
        let executablePath: string | undefined;
        try {
            executablePath = execSync("which chromium", { encoding: "utf8" }).trim();
        } catch {
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
            const htmlContent = await this.generateOfferHTML(sale, packageData);
            await page.setContent(htmlContent, { waitUntil: "networkidle0" });
            const pdfBuffer = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
            });
            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }

    private getServiceNames(selectedServices: any[]): string {
        if (!selectedServices?.length) return "Не указаны";
        return selectedServices.map(s => {
            const title = s.title || s.name || 'Услуга';
            const sessions = s.sessionCount || s.count || 10;
            return `${title} (${sessions} сеансов)`;
        }).join(", ");
    }

    private getTotalSessions(selectedServices: any[]): number {
        if (!selectedServices?.length) return 0;
        return Math.max(...selectedServices.map(s => s.sessionCount || s.count || s.quantity || 10));
    }

    private getBonusPercent(packageType: string): number {
        return ({ vip: 20, standard: 15, economy: 10 } as Record<string, number>)[packageType] ?? 0;
    }

    private getPackagePerks(packageType: string): any {
        switch (packageType) {
            case "vip":
                return { massage: "Курс массажа вокруг глаз на аппарате Bork D617 - 10 сеансов", hasCard: true, card: "Золотая карта", cardDiscount: "35", freezeOption: "Бессрочно" };
            case "standard":
                return { massage: "Курс массажа вокруг глаз на аппарате Bork D617 - 5 сеансов", hasCard: true, card: "Серебряная карта", cardDiscount: "30", freezeOption: "6 мес" };
            default:
                return { massage: "Курс массажа вокруг глаз на аппарате Bork D617 - 3 сеанса", hasCard: false, card: "", cardDiscount: "", freezeOption: "3 мес" };
        }
    }

    private async generateOfferHTML(sale: Sale, packageData?: any): Promise<string> {
        const selectedServices = sale.selectedServices as any[];
        const packagePerks = this.getPackagePerks(sale.selectedPackage);

        const baseCost = parseFloat(sale.baseCost.toString());
        const finalCost = parseFloat(sale.finalCost.toString());
        const actualDiscountPercentage = baseCost > 0 ? Math.round(((baseCost - finalCost) / baseCost) * 100) : 0;

        // Gift sessions: prefer manual override → packageData → 0
        let giftSessions = 0;
        const manualGiftSessions = sale.manualGiftSessions as any;
        if (manualGiftSessions && typeof manualGiftSessions === 'object' && manualGiftSessions[sale.selectedPackage] !== undefined) {
            giftSessions = manualGiftSessions[sale.selectedPackage];
        } else if (packageData?.giftSessions !== undefined) {
            giftSessions = packageData.giftSessions;
        }

        const bonusPercent = packageData?.bonusAccountPercent !== undefined
            ? Math.round(parseFloat(packageData.bonusAccountPercent.toString()) * 100)
            : this.getBonusPercent(sale.selectedPackage);

        const paymentSchedule = (sale.paymentSchedule as PaymentScheduleItem[] | null) ?? [];
        const isAmendment = (sale.pdfVersion || 'standard') === 'amendment';

        return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>${isAmendment ? 'Изменение условий договора' : 'Приложение №1 к договору-оферте'}</title>
    <style>
        @page { margin: 15mm; size: A4; }
        body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; margin: 0; padding: 10mm; color: #000; }
        .title { text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 20px; }
        .amendment-notice { text-align: center; font-size: 12pt; font-weight: bold; color: #D9534F; margin-bottom: 20px; padding: 10px; border: 2px solid #D9534F; background-color: #FFE6E6; }
        .subtitle { font-size: 11pt; font-weight: bold; margin-bottom: 15px; }
        .section { margin-bottom: 12px; }
        .perks-list { margin-left: 15px; margin-bottom: 8px; }
        .perks-list li { margin-bottom: 3px; }
        .cost-section { margin-top: 20px; margin-bottom: 15px; }
        .cost-item { margin-bottom: 4px; }
        .payment-table { width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #FFE6E6; }
        .payment-table th, .payment-table td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        .payment-table th { background-color: #FFB3B3; font-weight: bold; }
        .payment-schedule-title { text-align: center; font-weight: bold; margin: 20px 0 10px 0; }
        .footer-note { margin-top: 25px; font-size: 10pt; font-weight: bold; }
        .highlight { color: #4472C4; font-weight: bold; }
        .card-info { color: #4472C4; font-weight: bold; }
    </style>
</head>
<body>
    ${isAmendment ? `
    <div class="amendment-notice">⚠️ ИЗМЕНЕНИЕ УСЛОВИЙ ДОГОВОРА ⚠️</div>
    <div class="title">Дополнительное соглашение об изменении условий к договору-оферте на оказание услуг по системе абонементов в студиях аппаратной косметологии «Виви»</div>
    ` : `
    <div class="title">Приложение № 1 к договору-оферте на оказание услуг по системе абонементов в студиях аппаратной косметологии «Виви» (Текст договора-оферты размещен на vivilaser.ru)</div>
    `}

    <div class="subtitle">Стороны договорились о следующих услугах, входящих в Абонемент</div>

    <div class="section">
        <div>1. Наименование услуги "<span class="highlight">${this.getServiceNames(selectedServices)}</span>"</div>
    </div>

    <div class="section">
        <div>2. Количество сеансов: <span class="highlight">${this.getTotalSessions(selectedServices)}</span></div>
    </div>

    <div class="section">
        <div>2. Индивидуальная скидка от стоимости прайса-листа: <span class="highlight">${actualDiscountPercentage}%</span></div>
    </div>

    <div class="section">
        <div>3. Право на подарки:</div>
        <ul class="perks-list">
            <li>за приглашение подруг - 1 зона за каждую подругу;</li>
            <li>отзывы на Яндекс.Карты и 2ГИС - 1 зона за каждый честный отзыв;</li>
            <li>за рекомендации в соцсетях - 1 зона за упоминание в соцсетях.</li>
        </ul>
    </div>

    <div class="section">
        <div>4. Курс массажа вокруг глаз на аппарате Bork D617 - <span class="highlight">${this.getTotalSessions(selectedServices)}</span> сеансов</div>
    </div>

    ${packagePerks.hasCard ? `
    <div class="section">
        <div>5. <span class="card-info">${packagePerks.card}</span>, дающая скидку навсегда в размере <span class="highlight">${packagePerks.cardDiscount}%</span> на</div>
        <ul class="perks-list">
            <li>поддерживающие процедуры выбранных зон во всех студиях сети «Виви»</li>
        </ul>
    </div>
    ` : ''}

    ${sale.selectedPackage !== "economy" ? `
    <div class="section">
        <div>${packagePerks.hasCard ? "6" : "5"}. Количество дополнительных подарочных сеансов: <span class="highlight">${giftSessions}</span></div>
    </div>
    ` : ''}

    <div class="section">
        <div>${sale.selectedPackage === "economy" ? (packagePerks.hasCard ? "6" : "5") : (packagePerks.hasCard ? "7" : "6")}. Возможность заморозки карты: <span class="highlight">${packagePerks.freezeOption}</span></div>
    </div>

    ${sale.selectedPackage !== "economy" ? `
    <div class="section">
        <div>${packagePerks.hasCard ? "8" : "7"}. Начисление на бонусный счет: <span class="highlight">${bonusPercent}%</span> от стоимости абонемента</div>
    </div>
    ` : ''}

    <div class="cost-section">
        <div class="cost-item">Стоимость абонемента: <span class="highlight">${this.formatAmount(sale.finalCost)} руб.</span></div>
        <div class="cost-item">Первоначальный взнос: <span class="highlight">${this.formatAmount(sale.downPayment)} руб.</span></div>
        ${sale.installmentMonths && sale.installmentMonths > 1 ? `
        <div class="cost-item">Размер платежа: <span class="highlight">${this.formatAmount(sale.monthlyPayment || 0)} руб.</span></div>
        <div class="cost-item">Количество платежей: <span class="highlight">${sale.installmentMonths}</span></div>
        ` : ''}
    </div>

    ${paymentSchedule.length > 0 ? `
    <div class="payment-schedule-title">График платежей</div>
    <table class="payment-table">
        <thead><tr><th>Дата платежа</th><th>Сумма платежа</th></tr></thead>
        <tbody>
            ${paymentSchedule.map(p => `<tr><td>${p.date}</td><td>${this.formatAmount(p.amount)} руб.</td></tr>`).join('')}
        </tbody>
    </table>
    ` : ''}

    <div class="footer-note">
        Условия действуют только при своевременной оплате. При просрочке платежа более чем на 5 дней стоимость посещения пересчитывается по стандартному прайсу и дополнительные условия (скидки, пакеты, бонусы и привилегии) аннулируются.
    </div>

    <div class="section" style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px;">
        <div><strong>Данные клиента:</strong></div>
        <div>ФИО: <span class="highlight">${sale.clientName || "Не указано"}</span></div>
        <div>Телефон: <span class="highlight">${sale.clientPhone || "Не указан"}</span></div>
        <div>Email: <span class="highlight">${sale.clientEmail || "Не указан"}</span></div>
        <div>Дата: <span class="highlight">${format(new Date(), "dd.MM.yyyy", { locale: ru })}</span></div>
    </div>
</body>
</html>`;
    }

    private formatAmount(amount: string | number | null | undefined): string {
        const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
        return new Intl.NumberFormat("ru-RU").format(num);
    }
}

export const pdfGenerator = new PDFGenerator();
