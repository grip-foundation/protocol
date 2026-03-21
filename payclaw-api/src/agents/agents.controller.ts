import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, Min, Max } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { AgentsService } from './agents.service';

class CreateAgentDto {
  @IsString() agentId: string;
  @IsString() name: string;
  @IsString() modelVersion: string;
  @IsArray() capabilities: string[];
  @IsOptional() @IsString() walletAddress?: string;
}

class IssueSessionKeyDto {
  @IsNumber() @Min(0) dailyLimitUsdc: number;
  @IsNumber() @Min(0) perTxLimitUsdc: number;
  @IsNumber() @Min(0) escalationUsdc: number;
  @IsNumber() @Min(1) @Max(8760) validForHours: number;
  @IsOptional() @IsArray() allowedContracts?: string[];
}

class RegisterOnChainDto {
  @IsString() walletAddress: string;
}

@ApiTags('Agents')
@ApiSecurity('api-key')
@UseGuards(AuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  create(@Request() req, @Body() dto: CreateAgentDto) {
    return this.agentsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all agents' })
  findAll(@Request() req) {
    return this.agentsService.findAll(req.user.id);
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get agent details + on-chain reputation' })
  findOne(@Request() req, @Param('agentId') agentId: string) {
    return this.agentsService.findOne(req.user.id, agentId);
  }

  @Post(':agentId/register-on-chain')
  @ApiOperation({ summary: 'Register agent DID on Grip Protocol (Base)' })
  registerOnChain(
    @Request() req,
    @Param('agentId') agentId: string,
    @Body() dto: RegisterOnChainDto,
  ) {
    return this.agentsService.registerOnChain(agentId, dto.walletAddress as `0x${string}`);
  }

  @Post(':agentId/session-keys')
  @ApiOperation({ summary: 'Issue a scoped session key for the agent' })
  issueSessionKey(
    @Param('agentId') agentId: string,
    @Body() dto: IssueSessionKeyDto,
  ) {
    return this.agentsService.issueSessionKey(agentId, dto);
  }
}
