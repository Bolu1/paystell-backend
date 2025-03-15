import { WebhookNotificationService } from "../services/webhookNotification.service";
import { WebhookPayload } from "../interfaces/webhook.interfaces";
import { MerchantAuthService } from "../services/merchant.service";
import { WebhookService } from "../services/webhook.service";
import { Request, Response } from "express";
import { CryptoGeneratorService } from "../services/cryptoGenerator.service";

// TODO: this initialization needs to be moved to dependency injection
const defaultWebhookService = new WebhookService();
const defaultMerchantAuthService = new MerchantAuthService();
const defaultCryptoGeneratorService = new CryptoGeneratorService();
const defaultWebhookNotificationService = new WebhookNotificationService(
  defaultMerchantAuthService,
  defaultCryptoGeneratorService
);

export class WebhookController {
  private webhookService: WebhookService;
  private webhookNotificationService: WebhookNotificationService;
  private merchantAuthService: MerchantAuthService;

  constructor(
    webhookService?: WebhookService,
    merchantAuthService?: MerchantAuthService,
    webhookNotificationService?: WebhookNotificationService
  ) {
    this.webhookService = webhookService || defaultWebhookService;
    this.merchantAuthService = merchantAuthService || defaultMerchantAuthService;
    this.webhookNotificationService = webhookNotificationService || defaultWebhookNotificationService;
  }

  async handleWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const { signature } = req.headers;
      const merchantId = req.params.merchantId;

      if (!signature || !merchantId) {
        return res.status(400).json({
          status: "error",
          code: "MISSING_PARAMETERS",
          message: "Missing required parameters",
        });
      }

      // Get merchant and webhook
      const merchant = await this.merchantAuthService.getMerchantById(merchantId);
      if (!merchant) {
        return res.status(404).json({
          status: "error",
          code: "MERCHANT_NOT_FOUND",
          message: "Merchant not found",
        });
      }

      const webhook = await this.webhookService.getMerchantWebhook(merchantId);
      if (!webhook) {
        return res.status(404).json({
          status: "error",
          code: "WEBHOOK_NOT_FOUND",
          message: "Webhook not found",
        });
      }

      // Verify signature
      const payload = req.body as WebhookPayload;
      const isValid = await this.webhookNotificationService.sendWebhookNotification(
        webhook.url,
        payload,
        merchantId
      );

      if (!isValid) {
        return res.status(401).json({
          status: "error",
          code: "INVALID_SIGNATURE",
          message: "Invalid webhook signature",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Webhook processed successfully",
      });
    } catch (error) {
      console.error("Webhook error: ", error);
      return res.status(500).json({
        status: "error",
        code: "INTERNAL_ERROR",
        message: (error as Error).message,
      });
    }
  }

  async testWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const merchantId = req.user?.id?.toString();

      if (!merchantId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      // Get merchant and webhook
      const merchant = await this.merchantAuthService.getMerchantById(merchantId);
      if (!merchant) {
        return res.status(404).json({
          status: "error",
          message: "Merchant not found",
        });
      }

      const webhook = await this.webhookService.getMerchantWebhook(merchantId);
      if (!webhook) {
        return res.status(404).json({
          status: "error",
          message: "No webhook configured for this merchant",
        });
      }

      // Create test webhook payload
      const testPayload: WebhookPayload = {
        transactionId: `test-tx-${Date.now()}`,
        transactionType: "TEST_TRANSACTION",
        status: "completed",
        amount: "0.00",
        asset: "TEST",
        merchantId,
        timestamp: new Date().toISOString(),
        eventType: "test.completed",
        reqMethod: "POST",
        metadata: {
          isTest: true,
          testGenerated: new Date().toISOString(),
          message: "This is a test webhook notification. No actual transaction has occurred.",
        },
      };

      // Send test webhook
      const success = await this.webhookNotificationService.sendWebhookNotification(
        webhook.url,
        testPayload,
        merchantId
      );

      if (!success) {
        return res.status(500).json({
          status: "error",
          message: "Failed to send test webhook",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Test webhook sent successfully",
        details: {
          webhookUrl: webhook.url,
          note: "This test webhook uses zero amounts and TEST values to avoid confusion with real transactions.",
          sentPayload: testPayload,
        },
      });
    } catch (error) {
      console.error("Test webhook error: ", error);
      return res.status(500).json({
        status: "error",
        message: (error as Error).message,
      });
    }
  }
}
