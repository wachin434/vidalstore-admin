import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class RolGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const grupos: string[] = req.claims?.['cognito:groups'] ?? [];

    if (!grupos.includes('administradores')) {
      throw new ForbiddenException('solo administradores acceden a este recurso');
    }
    return true;
  }
}