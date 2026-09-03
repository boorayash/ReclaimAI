import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Controller('audit-log')
@UseGuards(JwtAuthGuard) // read-only — both ADMIN and REVIEWER can view
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: QueryAuditLogDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 200); // hard cap

    const where = {
      ...(query.caseId ? { caseId: query.caseId } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
    };

    const [total, events] = await this.prisma.$transaction([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          case: {
            select: {
              type: true,
              invoice: { select: { customerName: true } },
              paymentAttempt: { select: { failureReason: true } },
            },
          },
        },
      }),
    ]);

    // Flatten so frontend gets display-ready label per row
    const items = events.map((e) => ({
      id: e.id,
      caseId: e.caseId,
      caseType: e.case.type,
      caseLabel:
        e.case.type === 'B2B_RECEIVABLE'
          ? (e.case.invoice?.customerName ?? 'Unknown customer')
          : (e.case.paymentAttempt?.failureReason ?? 'Payment failure'),
      eventType: e.eventType,
      payload: e.payload,
      createdAt: e.createdAt,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
