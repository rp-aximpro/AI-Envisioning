import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { type ApiRequest } from '../common/http/request-response.types.js';
import { Workshop } from '../database/entities/workshop.entity.js';
import { readTrackingSessionToken } from './tracking-session-cookie.js';
import { TrackingSessionService } from './tracking-session.service.js';

@Injectable()
export class RequireTrackingWorkshopGuard implements CanActivate {
  constructor(
    @InjectRepository(Workshop) private readonly workshopRepository: Repository<Workshop>,
    @Inject(TrackingSessionService) private readonly trackingSessions: TrackingSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiRequest & { params: { trackingToken?: string } }>();
    const trackingToken = request.params.trackingToken;
    if (!trackingToken) throw AppError.unauthorized();
    const workshop = await this.workshopRepository.findOne({ where: { trackingToken } });
    if (!workshop) throw AppError.notFound('Workshop not found.');
    const identity = await this.trackingSessions.getIdentity(readTrackingSessionToken(request), workshop.id);
    if (!identity || identity.domain !== workshop.creatorDomain) throw AppError.unauthorized();
    return true;
  }
}
