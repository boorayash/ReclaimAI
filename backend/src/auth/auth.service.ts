import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

// All auth logic lives here, server-side. The frontend never decides
// who's allowed to do what — it just sends credentials, gets a token
// back, and attaches that token to future requests. Every mutating
// endpoint (approve a case, advance the sim clock, trigger an action)
// is guarded server-side using this token — see auth.guard.ts.
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async createUser(email: string, password: string, role: 'ADMIN' | 'REVIEWER' = 'REVIEWER') {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { email, passwordHash, role },
    });
  }
}
