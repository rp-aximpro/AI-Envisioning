import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { RequireAdminGuard } from './require-admin.guard.js';
import { AdminDomainsService, type AdminDomainInput, type AdminDomainUpdate } from './admin-domains.service.js';

const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const domainSchema = z.string().trim().toLowerCase().max(253).regex(domainPattern, 'Enter a valid domain, such as example.com.');
const createSchema = z.object({
  displayName: z.string().trim().min(1).max(150),
  domain: domainSchema,
});
const updateSchema = z.object({
  active: z.boolean().optional(),
  displayName: z.string().trim().min(1).max(150).optional(),
  domain: domainSchema.optional(),
}).refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update.');
const idSchema = z.string().uuid();

@Controller('api/admin/domains')
@UseGuards(RequireAdminGuard)
export class AdminDomainsController {
  constructor(@Inject(AdminDomainsService) private readonly domainsService: AdminDomainsService) {}

  @Get()
  list() {
    return this.domainsService.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createSchema)) input: AdminDomainInput) {
    return this.domainsService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateSchema)) input: AdminDomainUpdate,
  ) {
    return this.domainsService.update(id, input);
  }
}
