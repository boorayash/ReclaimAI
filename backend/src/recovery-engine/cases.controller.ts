import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RecoveryEngineService } from './recovery-engine.service';
import { CreateCaseDto } from './dto/create-case.dto';

@Controller('cases')
@UseGuards(JwtAuthGuard) // every endpoint here requires a logged-in user
export class CasesController {
  constructor(
    private prisma: PrismaService,
    private recoveryEngine: RecoveryEngineService,
  ) {}

  // Read-only — any authenticated user (ADMIN or REVIEWER) can list/view.
  @Get()
  async list() {
    return this.prisma.case.findMany({
      include: { invoice: true, paymentAttempt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.prisma.case.findUniqueOrThrow({
      where: { id },
      include: {
        invoice: true,
        paymentAttempt: true,
        recoveryActions: true,
        auditEvents: { orderBy: { createdAt: 'asc' } },
        promises: true,
        payments: true,
      },
    });
  }

  // Creates a case AND auto-processes it immediately (per our
  // "production-correct by default" decision), then returns the
  // resulting state.
  @Post()
  async create(@Body() dto: CreateCaseDto) {
    const kase = await this.prisma.case.create({
      data: {
        type: dto.type,
        ...(dto.type === 'B2B_RECEIVABLE'
          ? {
              invoice: {
                create: {
                  customerName: dto.customerName!,
                  invoiceAmount: dto.invoiceAmount!,
                  dueSimDay: dto.dueSimDay!,
                },
              },
            }
          : {
              paymentAttempt: {
                create: {
                  originalAmount: dto.originalAmount!,
                  failureReason: dto.failureReason!,
                },
              },
            }),
      },
    });

    return this.recoveryEngine.processCase(kase.id);
  }

  // Manual re-trigger — safe to call repeatedly (see recovery-engine
  // service for why). Used for retries, demo control, or after the
  // sim clock advances.
  @Post(':id/process')
  async process(@Param('id') id: string) {
    return this.recoveryEngine.processCase(id);
  }

  // Admin-only: approve a PENDING_APPROVAL case. This is the human
  // half of "bounded autonomy" — enforced server-side via RolesGuard,
  // not by hiding a button in the frontend.
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.recoveryEngine.approveCase(id, user.userId);
  }
}
