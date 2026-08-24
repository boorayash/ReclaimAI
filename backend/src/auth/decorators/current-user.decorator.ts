import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Usage in a controller: approve(@CurrentUser() user) — instead of
// digging into the raw request object every time you need to know
// who's making the call (e.g. to log it in AuditEvent).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
