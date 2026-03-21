import { Controller, Post, Get, Body, Headers, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { PixService } from './pix.service';

class PixDepositDto {
  @IsString() agentId: string;
  @IsNumber() @Min(1) amountBrl: number;
}

class PixWithdrawDto {
  @IsString() agentId: string;
  @IsNumber() @Min(1) amountBrl: number;
  @IsString() pixKey: string;
}

@ApiTags('Pix')
@Controller('pix')
export class PixController {
  constructor(private pixService: PixService) {}

  @Post('deposit')
  @ApiSecurity('api-key')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Generate Pix QR code to fund agent wallet (BRL → USDC)' })
  deposit(@Request() req, @Body() dto: PixDepositDto) {
    return this.pixService.generateDepositQr(req.user.id, dto);
  }

  @Post('withdraw')
  @ApiSecurity('api-key')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Withdraw from agent wallet via Pix (USDC → BRL)' })
  withdraw(@Request() req, @Body() dto: PixWithdrawDto) {
    return this.pixService.withdraw(req.user.id, dto);
  }

  @Get('rate')
  @ApiOperation({ summary: 'Current BRL/USDC exchange rate' })
  getRate() {
    return this.pixService.getUsdcBrlRate().then((rate) => ({
      brl_per_usdc: rate,
      usdc_per_brl: 1 / rate,
      source: 'coingecko',
      timestamp: new Date().toISOString(),
    }));
  }

  @Post('webhook')
  @ApiOperation({ summary: 'GlobalPix webhook receiver (internal)' })
  handleWebhook(
    @Body() payload: any,
    @Headers('x-globalpix-signature') signature: string,
  ) {
    return this.pixService.handleWebhook(payload, signature);
  }
}
