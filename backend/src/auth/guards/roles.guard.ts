import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Runs after JwtAuthGuard. Reads the @Roles(...) metadata off the route
// and checks it against req.user.role (set by JwtStrategy). This is
// what makes "high-risk case approval requires ADMIN" an actual
// server-side rule rather than a frontend convention.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no @Roles(...) set — any authenticated user is fine
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.includes(user?.role);
  }
}
