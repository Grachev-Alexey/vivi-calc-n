import nodemailer from "nodemailer";
import { Offer } from "@shared/schema";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: string;
}

export class EmailService {
    private transporter: nodemailer.Transporter;
    private config: EmailConfig;

    constructor(config: EmailConfig) {
        this.config = config;
        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth,
        });
    }

    async sendOfferEmail(offer: Offer, pdfBuffer: Buffer): Promise<boolean> {
        try {
            if (!offer.clientEmail) {
                throw new Error("Email клиента не указан");
            }

            const mailOptions = {
                from: `"Студия Виви" <${this.config.from}>`,
                to: offer.clientEmail,
                subject: `Приложение к договору-оферте №${offer.offerNumber} от студии Виви`,
                html: this.generateEmailHTML(offer),
                attachments: [
                    {
                        filename: `Приложение_${offer.offerNumber}.pdf`,
                        content: pdfBuffer,
                        contentType: "application/pdf",
                    },
                ],
            };

            const result = await this.transporter.sendMail(mailOptions);
            return !!result && "messageId" in result && !!result.messageId;
        } catch (error) {
            console.error("Ошибка отправки email:", error);
            return false;
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            console.error("Ошибка подключения к почтовому серверу:", error);
            return false;
        }
    }

    private generateEmailHTML(offer: Offer): string {
        const packageName = this.getPackageName(offer.selectedPackage);
        const formattedDate = format(
            new Date(offer.createdAt!),
            "dd MMMM yyyy",
            { locale: ru },
        );
        
        // Calculate gift sessions - use manual override if available
        let giftSessions = 0;
        const manualGiftSessions = offer.manualGiftSessions as any;
        if (manualGiftSessions && manualGiftSessions[offer.selectedPackage] !== undefined) {
            giftSessions = manualGiftSessions[offer.selectedPackage];
        } else {
            // Fallback to default values
            switch (offer.selectedPackage) {
                case "vip": giftSessions = 3; break;
                case "standard": giftSessions = 1; break;
                case "economy": giftSessions = 0; break;
                default: giftSessions = 0; break;
            }
        }

        return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Приложение к договору-оферте от студии Виви</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #e91e63;
            padding-bottom: 20px;
        }
        .logo {
            color: #e91e63;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .offer-number {
            background-color: #e91e63;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
            font-weight: bold;
            margin: 10px 0;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #2c3e50;
        }
        .offer-details {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #e91e63;
        }
        .offer-item {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 5px 0;
            border-bottom: 1px dotted #ddd;
        }
        .offer-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 18px;
            color: #e91e63;
        }
        .highlight {
            background-color: #fff3cd;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
        }
        .cta-button {
            background-color: #e91e63;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            display: inline-block;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
        .contact-info {
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .contact-item {
            margin: 5px 0;
        }
        .social-links {
            text-align: center;
            margin: 20px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #e91e63;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ViVi</div>
            <p>Сеть студий лазерной эпиляции</p>
            <div class="offer-number">Приложение №1 к договору-оферте №${offer.offerNumber}</div>
        </div>

        <div class="greeting">
            Здравствуйте, ${offer.clientName || "дорогой клиент"}!
        </div>

        <p>Благодарим вас за интерес к услугам нашей студии лазерной эпиляции.</p>

        <div class="offer-details">
            <h3 style="margin-top: 0; color: #e91e63;">Детали вашего абонемента:</h3>
            <div class="offer-item">
                <span>Услуги:</span>
                <span><strong>${this.getServiceNames(Array.isArray(offer.selectedServices) ? offer.selectedServices : [])}</strong></span>
            </div>
            <div class="offer-item">
                <span>Базовая стоимость:</span>
                <span>${this.formatAmount(offer.baseCost)} руб.</span>
            </div>
            <div class="offer-item">
                <span>Ваша экономия:</span>
                <span style="color: #28a745;"><strong>${this.formatAmount(offer.totalSavings)} руб.</strong></span>
            </div>
            <div class="offer-item">
                <span>Итоговая стоимость:</span>
                <span>${this.formatAmount(offer.finalCost)} руб.</span>
            </div>
        </div>
        <p style="text-align: center;">
            <a href="tel:+79697771485" class="cta-button">Записаться на процедуру</a>
        </p>

        <div class="contact-info">
            <h4 style="margin-top: 0; color: #e91e63;">Контакты для записи:</h4>
            <div class="contact-item">📞 <strong>Телефон:</strong> +7 (969) 777-14-85</div>
            <div class="contact-item">💬 <strong>WhatsApp:</strong> +7 (995) 663-86-25</div>
            <div class="contact-item">🌐 <strong>Сайт:</strong> vivilaser.ru</div>
        </div>

        <p>Детальную информацию о составе абонемента, графике платежей и условиях предоставления услуг вы найдете в прикрепленном PDF-документе.</p>

        <div class="footer">
            <p>С уважением,<br>
            Команда студии лазерной эпиляции «Виви»</p>
            
            <p style="font-size: 12px; color: #999;">
                Данное письмо отправлено автоматически. Если вы получили его по ошибке, просто проигнорируйте.
                <br>Дата формирования: ${formattedDate}
            </p>
        </div>
    </div>
</body>
</html>
    `;
    }

    private getPackageName(packageType: string): string {
        switch (packageType) {
            case "vip":
                return "VIP (максимальная скидка 25%)";
            case "standard":
                return "Стандарт (скидка 15%)";
            case "economy":
                return "Эконом (скидка 10%)";
            default:
                return packageType;
        }
    }

    private getServiceNames(selectedServices: any[]): string {
        if (!selectedServices || selectedServices.length === 0) {
            return "Не указаны";
        }
        
        return selectedServices.map(service => service.title).join(", ");
    }

    private formatAmount(amount: string | number): string {
        const num = typeof amount === "string" ? parseFloat(amount) : amount;
        return new Intl.NumberFormat("ru-RU").format(num);
    }
}

// Фабрика для создания email сервиса с разными провайдерами
export class EmailServiceFactory {
    static createGmailService(
        email: string,
        appPassword: string,
    ): EmailService {
        return new EmailService({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: email,
                pass: appPassword,
            },
            from: email,
        });
    }

    static createYandexService(email: string, password: string): EmailService {
        return new EmailService({
            host: "smtp.yandex.ru",
            port: 465,
            secure: true,
            auth: {
                user: email,
                pass: password,
            },
            from: email,
        });
    }

    static createMailRuService(email: string, password: string): EmailService {
        return new EmailService({
            host: "smtp.mail.ru",
            port: 465,
            secure: true,
            auth: {
                user: email,
                pass: password,
            },
            from: email,
        });
    }
}