import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { PaymentsService } from './payments.service';

class PayDto {
  @IsString() agentId: string;
  @IsString() to: string;
  @IsNumber() @Min(0.000001) amountUsdc: number;
  @IsOptional() @IsString() memo?: string;
}

class CreateEscrowDto {
  @IsString() agentId: string;
  @IsString() payeeAddress: string;
  @IsNumber() @Min(0.000001) amountUsdc: number;
  @IsString() serviceId: string;
  @IsOptional() @IsString() commitHash?: string;
  @IsOptional() @IsNumber() timeoutSeconds?: number;
  @IsOptional() @IsString() memo?: string;
}

@ApiTags('Payments')
@ApiSecurity('api-key')
@UseGuards(AuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('pay')
  @ApiOperation({ summary: 'Direct payment from agent to address' })
  pay(@Request() req, @Body() dto: PayDto) {
    return this.paymentsService.pay(req.user.id, dto);
  }

  @Post('escrow')
  @ApiOperation({ summary: 'Create escrow for A2A service payment' })
  createEscrow(@Request() req, @Body() dto: CreateEscrowDto) {
    return this.paymentsService.createEscrow(req.user.id, dto);
  }

  @Post('escrow/:escrowId/release')
  @ApiOperation({ summary: 'Release escrow to payee (payer confirms delivery)' })
  releaseEscrow(@Request() req, @Param('escrowId') escrowId: string) {
    return this.paymentsService.releaseEscrow(req.user.id, Number(escrowId));
  }

  @Post('escrow/:escrowId/refund')
  @ApiOperation({ summary: 'Refund expired escrow' })
  refundExpired(@Param('escrowId') escrowId: string) {
    return this.paymentsService.refundExpired(Number(escrowId));
  }

  @Get('history')
  @ApiOperation({ summary: 'Payment history across all agents' })
  getHistory(@Request() req) {
    return this.paymentsService.getHistory(req.user.id);
  }

  @Get('balance/:agentId')
  @ApiOperation({ summary: 'USDC balance for an agent wallet' })
  getBalance(@Request() req, @Param('agentId') agentId: string) {
    return this.paymentsService.getBalance(req.user.id, agentId);
  }
}
