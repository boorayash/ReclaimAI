import { SetMetadata } from '@nestjs/common';

// Usage: @Roles('ADMIN')  above a controller method, paired with
// @UseGuards(JwtAuthGuard, RolesGuard). Used for endpoints only an
// ADMIN should hit, e.g. approving a high-risk recovery action.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
