import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey =
      request.headers['x-api-key'] ??
      request.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) throw new UnauthorizedException('Missing API key');

    const payload = await this.authService.validateApiKey(apiKey);
    request.user = payload;
    return true;
  }
}
