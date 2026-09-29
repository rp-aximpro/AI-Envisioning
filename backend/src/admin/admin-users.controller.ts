import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { type ApiRequest } from '../common/http/request-response.types.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { type AdminIdentity } from './admin-auth.service.js';
import { AdminUsersService, type AdminUserInput } from './admin-users.service.js';
import { RequireAdminGuard } from './require-admin.guard.js';

const createSchema = z.object({
  displayName: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(320),
  password: z.string().min(12, 'Use a password with at least 12 characters.').max(256),
});
const activeSchema = z.object({ active: z.boolean() });
const idSchema = z.string().uuid();

function requireIdentity(request: ApiRequest): AdminIdentity {
  if (!request.adminIdentity) throw AppError.unauthorized();
  return request.adminIdentity;
}

@Controller('api/admin/users')
@UseGuards(RequireAdminGuard)
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly adminsService: AdminUsersService) {}

  @Get()
  list() {
    return this.adminsService.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createSchema)) input: AdminUserInput) {
    return this.adminsService.create(input);
  }

  @Patch(':id')
  setActive(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(activeSchema)) input: { active: boolean },
    @Req() request: ApiRequest,
  ) {
    return this.adminsService.setActive(id, input.active, requireIdentity(request).adminId);
  }
}
