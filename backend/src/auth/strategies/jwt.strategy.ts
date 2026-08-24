import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Runs on every request to a guarded endpoint. Pulls the JWT from the
// Authorization header, verifies its signature, and attaches the decoded
// payload to req.user. If the token is missing/invalid/expired, the
// request is rejected with 401 before it ever reaches a controller.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-me',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    // Whatever is returned here becomes req.user in controllers/guards.
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
