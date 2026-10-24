import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Entrega el claim `sub` del token ya verificado por JwtGuard.
 * La identidad de quien hace la petición sale solo de ahí: nunca del cuerpo,
 * de un parámetro ni de un header.
 */
export const UsuarioSub = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.claims?.sub;
  },
);
