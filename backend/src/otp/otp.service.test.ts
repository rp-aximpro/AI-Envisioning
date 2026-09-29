import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { AppError } from '../common/errors/app-error.js';
import { OtpChallenge, OtpPurpose } from '../database/entities/otp-challenge.entity.js';
import type { EmailDeliveryMode, EmailProvider, SendOtpEmailInput } from '../email/email-provider.js';
import { OtpService } from './otp.service.js';

function createChallenge(overrides: Partial<OtpChallenge> = {}): OtpChallenge {
  return Object.assign(new OtpChallenge(), {
    attemptCount: 0,
    codeHash: '',
    consumedAt: null,
    createdAt: new Date(),
    email: 'person@example.local',
    expiresAt: new Date(Date.now() + 60_000),
    id: 'f51432e6-5a05-4c4d-95f9-2a18b014bb52',
    maxAttempts: 5,
    purpose: OtpPurpose.CreateWorkshop,
    requestIp: null,
    workshopId: null,
    ...overrides,
  });
}

function createService() {
  const repository = {
    create: vi.fn((input: Partial<OtpChallenge>) => createChallenge(input)),
    findOne: vi.fn(),
    save: vi.fn((challenge: OtpChallenge) => Promise.resolve(challenge)),
  };
  let sentEmail: SendOtpEmailInput | undefined;
  const sendOtp = vi.fn((input: SendOtpEmailInput): Promise<void> => {
    sentEmail = input;
    return Promise.resolve();
  });
  const emailProvider: EmailProvider = {
    sendOtp,
    sendWorkshopConfirmation: vi.fn((): Promise<EmailDeliveryMode> => Promise.resolve('logged')),
  };

  return {
    emailProvider,
    repository,
    sentEmail: () => sentEmail,
    service: new OtpService(repository as unknown as Repository<OtpChallenge>, emailProvider),
  };
}

describe('OtpService', () => {
  it('stores only a hash and sends a six-digit code', async () => {
    const { repository, sentEmail, service } = createService();
    repository.findOne.mockResolvedValue(null);

    await service.issue({ email: ' Person@Example.Local ', purpose: OtpPurpose.CreateWorkshop });

    const challenge = repository.create.mock.results[0]?.value as OtpChallenge;
    const email = sentEmail();
    expect(challenge.email).toBe('person@example.local');
    expect(challenge.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(challenge.codeHash).not.toBe(email?.code);
    expect(email?.code).toMatch(/^\d{6}$/);
  });

  it('enforces the resend cooldown', async () => {
    const { repository, service } = createService();
    repository.findOne.mockResolvedValue(createChallenge({ createdAt: new Date() }));

    await expect(service.issue({ email: 'person@example.local', purpose: OtpPurpose.CreateWorkshop })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      statusCode: 429,
    } satisfies Partial<AppError>);
  });

  it('counts invalid attempts and consumes a challenge at the limit', async () => {
    const { repository, service } = createService();
    const challenge = createChallenge({ maxAttempts: 1 });
    repository.findOne.mockResolvedValue(challenge);

    await expect(service.verify({ code: '000000', email: challenge.email, purpose: challenge.purpose })).rejects.toMatchObject({
      statusCode: 400,
    } satisfies Partial<AppError>);

    expect(challenge.attemptCount).toBe(1);
    expect(challenge.consumedAt).toBeInstanceOf(Date);
  });
});
