import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsUrl } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { WebhooksService, WebhookEvent } from './webhooks.service';

class RegisterWebhookDto {
  @IsUrl() url: string;
  @IsArray() @IsString({ each: true }) events: WebhookEvent[];
}

@ApiTags('Webhooks')
@ApiSecurity('api-key')
@UseGuards(AuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  register(@Request() req, @Body() dto: RegisterWebhookDto) {
    return this.webhooks.register(req.user.owner_id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List registered webhooks' })
  list(@Request() req) {
    return this.webhooks.list(req.user.owner_id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a webhook' })
  revoke(@Request() req, @Param('id') id: string) {
    return this.webhooks.revoke(req.user.owner_id, id);
  }
}
