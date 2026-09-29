import { Inject, Injectable } from '@nestjs/common';

import {
  type EmailDeliveryMode,
  type EmailProvider,
  type SendOtpEmailInput,
  type SendWorkshopConfirmationEmailInput,
} from './email-provider.js';
import { OtpPurpose } from '../database/entities/otp-challenge.entity.js';
import { getEnv } from '../infrastructure/env.js';
import { PinoLoggerService } from '../common/logging/pino-logger.service.js';

@Injectable()
export class SendGridEmailProvider implements EmailProvider {
  constructor(@Inject(PinoLoggerService) private readonly logger: PinoLoggerService) {}

  async sendOtp(input: SendOtpEmailInput): Promise<void> {
    await this.deliver({
      html: this.html(input),
      recipient: input.recipient,
      subject: 'Your AI Envisioning Workshop verification code',
      text: this.plainText(input),
    }, 'Development OTP email');
  }

  sendWorkshopConfirmation(input: SendWorkshopConfirmationEmailInput): Promise<EmailDeliveryMode> {
    return this.deliver(input, 'Development workshop confirmation email');
  }

  private async deliver(
    email: SendWorkshopConfirmationEmailInput,
    developmentLogLabel: string,
  ): Promise<EmailDeliveryMode> {
    const env = getEnv();
    if (!env.SENDGRID_API_KEY) {
      if (env.NODE_ENV === 'production') {
        throw new Error('SENDGRID_API_KEY must be configured in production.');
      }

      this.logger.info(developmentLogLabel, {
        html: email.html,
        recipient: email.recipient,
        subject: email.subject,
        text: email.text,
      });
      return 'logged';
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: this.fromAddress(env.EMAIL_FROM) },
        personalizations: [{ to: [{ email: email.recipient }] }],
        subject: email.subject,
        content: [
          { type: 'text/plain', value: email.text },
          { type: 'text/html', value: email.html },
        ],
      }),
    });

    if (!response.ok) {
      this.logger.error('SendGrid email delivery failed', { statusCode: response.status });
      throw new Error('Unable to send email.');
    }

    return 'sent';
  }

  private fromAddress(emailFrom: string): string {
    const match = /<([^>]+)>/.exec(emailFrom);
    return (match?.[1] ?? emailFrom).trim();
  }

  private plainText(input: SendOtpEmailInput): string {
    const purpose = input.purpose === OtpPurpose.CreateWorkshop ? 'create a workshop request' : 'access a workshop';
    return `Use verification code ${input.code} to ${purpose}. It expires in 10 minutes. Do not share this code.`;
  }

  private html(input: SendOtpEmailInput): string {
    const purpose = input.purpose === OtpPurpose.CreateWorkshop ? 'create a workshop request' : 'access a workshop';
    return `<p>Use this verification code to ${purpose}:</p><p><strong>${input.code}</strong></p><p>This code expires in 10 minutes. Do not share it.</p>`;
  }
}
