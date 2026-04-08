import nodemailer from "nodemailer";
import { config } from "../../config/config.js";
import { createLogger } from "./logger.js";

const log = createLogger("EmailService");

/**
 * Service for sending emails via Nodemailer.
 */
class EmailService {
    private transporter: nodemailer.Transporter | null = null;

    constructor() {
        if (config.email.host && config.email.user) {
            this.transporter = nodemailer.createTransport({
                host: config.email.host,
                port: config.email.port,
                secure: config.email.secure,
                auth: {
                    user: config.email.user,
                    pass: config.email.pass,
                },
            });
            log.info(`EmailService configured with host: ${config.email.host}`);
        } else {
            log.warn("EmailService not configured properly (missing SMTP host or user in env)");
        }
    }

    /**
     * Sends a generic email.
     * @param {string} to - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} html - Email body in HTML format
     */
    async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
        if (!this.transporter) {
            log.error("Cannot send email: Transporter not initialised");
            return false;
        }

        try {
            // verify connection
            await this.transporter.verify();

            await this.transporter.sendMail({
                from: `"${config.email.fromName}" <${config.email.fromAddress}>`,
                to,
                subject,
                html,
            });
            log.info(`Email sent successfully to: ${to}`);
            return true;
        } catch (error: any) {
            switch (error.code) {
                case "ECONNECTION":
                case "ETIMEDOUT":
                    log.error("Network error - retry later:", error.message);
                    break;
                case "EAUTH":
                    log.error("Authentication failed:", error.message);
                    break;
                case "EENVELOPE":
                    log.error("Invalid recipients:", error.rejected);
                    break;
                default:
                    log.error("Failed to send email", undefined, error ? error : undefined);
            }

            return false;
        }
    }

    /**
     * Sends an alert notification email.
     * @param {string} to - Recipient email
     * @param {Object} data - Alert details
     */
    async sendAlert(to: string, data: { ruleName: string; metric: string; value: number; threshold: number }) {
        const subject = `🚨 Alert Triggered: ${data.ruleName}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alert Triggered</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f13; color: #e4e4e7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f0f13; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #7f1d1d; padding: 24px; text-align: center; border-bottom: 1px solid #991b1b;">
              <h1 style="margin: 0; font-size: 24px; color: #fca5a5; font-weight: 600;">Monitor Alert Breached</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #a1a1aa;">
                An alert condition was met for rule <strong style="color: #e4e4e7;">${data.ruleName}</strong>. 
                Immediate attention may be required.
              </p>
              
              <!-- Metrics Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f0f13; border: 1px solid #27272a; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #27272a;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em;">Metric Monitored</span>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #e4e4e7; font-family: monospace;">${data.metric}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50%">
                          <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em;">Current Value</span>
                          <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #f87171;">${data.value}</p>
                        </td>
                        <td width="50%">
                          <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em;">Threshold</span>
                          <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #d4d4d8;">${data.threshold}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Action -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-top: 16px;">
                    <a href="${config.client_uri || 'http://localhost:5173'}" style="display: inline-block; padding: 12px 24px; background-color: #818cf8; color: #0f0f13; font-weight: 600; text-decoration: none; border-radius: 6px; font-size: 14px;">View in Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #111118; border-top: 1px solid #27272a; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #52525b;">
                You received this email because you configured an alert in API Monitoring System.<br>
                To stop receiving these, modify your alert rules in the dashboard.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;
        return this.sendEmail(to, subject, html);
    }
}

export const emailService = new EmailService();
