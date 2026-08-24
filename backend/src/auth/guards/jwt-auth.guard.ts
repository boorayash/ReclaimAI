import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Attach this to any endpoint that mutates state:
//   @UseGuards(JwtAuthGuard)
// e.g. approving a high-risk case, advancing the sim clock, or
// triggering a recovery action. Read-only dashboard endpoints can
// skip it if you want the demo to load without a login step, but
// anything that changes data must have it.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
