import { type OtpPurpose } from '../database/entities/otp-challenge.entity.js';

export interface SendOtpEmailInput {
  code: string;
  purpose: OtpPurpose;
  recipient: string;
}

export interface SendWorkshopConfirmationEmailInput {
  html: string;
  recipient: string;
  subject: string;
  text: string;
}

export type EmailDeliveryMode = 'sent' | 'logged';

export interface EmailProvider {
  sendOtp(input: SendOtpEmailInput): Promise<void>;
  sendWorkshopConfirmation(input: SendWorkshopConfirmationEmailInput): Promise<EmailDeliveryMode>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
