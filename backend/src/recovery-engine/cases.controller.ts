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
import { RespondDto } from './dto/respond.dto';

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

  // READ-ONLY aggregates, computed on demand from current DB state. No tables,
  // no cache, no background jobs. Declared BEFORE @Get(':id') so 'metrics'
  // isn't swallowed by the param route.
  //
  // Two complementary rates (distinct denominators, by design):
  //  - recoveryRate (case-count): RECOVERED / (RECOVERED+ESCALATED+UNRESOLVED) —
  //    concluded-only denominator, fully-recovered numerator. In-flight cases
  //    (ACTION_TAKEN/PENDING_APPROVAL/DIAGNOSING/PARTIALLY_RECOVERED) excluded.
  //  - moneyRecoveryRate (₹): recoveredAmount / expectedAmount over the WHOLE
  //    book (incl. still-in-flight), i.e. "of all at-risk money seen so far, how
  //    much actually came back".
  @Get('metrics')
  async metrics() {
    const byStatus = await this.prisma.case.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const totalCases = byStatus.reduce((s, r) => s + r._count._all, 0);
    const count = (st: string) => byStatus.find((r) => r.status === st)?._count._all ?? 0;
    const concluded = ['RECOVERED', 'ESCALATED', 'UNRESOLVED'];
    const recoveredCases = count('RECOVERED');
    const concludedCount = concluded.reduce((s, st) => s + count(st), 0);
    const recoveryRate = concludedCount ? recoveredCases / concludedCount : 0;

    // real money recovered — sum of actual Payment rows (incl. partial recoveries).
    const paid = await this.prisma.payment.aggregate({ _sum: { amount: true } });
    const recoveredAmount = Number(paid._sum.amount ?? 0);

    // full at-risk book.
    const inv = await this.prisma.invoice.aggregate({
      _sum: { invoiceAmount: true },
    });
    const att = await this.prisma.paymentAttempt.aggregate({
      _sum: { originalAmount: true },
    });
    const expectedAmount =
      Number(inv._sum.invoiceAmount ?? 0) + Number(att._sum.originalAmount ?? 0);

    // per-type status counts + per-type recovered ₹ (small scale — JS reduce is fine).
    const byTypeStatus = await this.prisma.case.groupBy({
      by: ['type', 'status'],
      _count: { _all: true },
    });
    const pays = await this.prisma.payment.findMany({
      select: { amount: true, case: { select: { type: true } } },
    });
    const byType = {} as Record<
      string,
      { totalCases: number; recoveredCases: number; recoveredAmount: number; recoveryRate: number }
    >;
    for (const type of ['B2B_RECEIVABLE', 'PAYMENT_FAILURE']) {
      const rows = byTypeStatus.filter((r) => r.type === type);
      const tc = rows.reduce((s, r) => s + r._count._all, 0);
      const rc = rows.find((r) => r.status === 'RECOVERED')?._count._all ?? 0;
      const cc = concluded.reduce(
        (s, st) => s + (rows.find((r) => r.status === st)?._count._all ?? 0),
        0,
      );
      const ra = pays
        .filter((p) => p.case.type === type)
        .reduce((s, p) => s + Number(p.amount), 0);
      byType[type] = {
        totalCases: tc,
        recoveredCases: rc,
        recoveredAmount: Number(ra.toFixed(2)),
        recoveryRate: cc ? rc / cc : 0,
      };
    }

    return {
      totalCases,
      recoveredCases,
      recoveredAmount,
      expectedAmount,
      moneyRecoveryRate: expectedAmount ? recoveredAmount / expectedAmount : 0,
      recoveryRate,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      byType,
    };
  }

  // Time-series cumulative recovery (₹). Declared BEFORE @Get(':id').
  @Get('metrics/timeseries')
  async metricsTimeseries() {
    const payments = await this.prisma.payment.findMany({
      select: { amount: true, simDay: true },
      orderBy: { simDay: 'asc' },
    });

    const byDay = new Map<number, number>();
    for (const p of payments) {
      byDay.set(p.simDay, (byDay.get(p.simDay) ?? 0) + Number(p.amount));
    }

    let cumulative = 0;
    const series = Array.from(byDay.entries())
      .sort(([a], [b]) => a - b)
      .map(([simDay, amount]) => {
        cumulative += amount;
        return { simDay, cumulativeRecovered: cumulative };
      });

    return { series };
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
                  succeedsOnRetryAt: dto.succeedsOnRetryAt,
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

    @Post(':id/respond')
  async respond(@Param('id') id: string, @Body() dto: RespondDto) {
    return this.recoveryEngine.handleClientResponse(id, dto.responseType, dto);
  }

  @Post('sim/advance-and-resolve')
  async advanceAndResolve(@Body('days') days: number) {
    return this.recoveryEngine.advanceClockAndResolve(days ?? 1);
  }

}
