import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCaseDto {
  @IsEnum(['PAYMENT_FAILURE', 'B2B_RECEIVABLE'])
  type: 'PAYMENT_FAILURE' | 'B2B_RECEIVABLE';

  // B2B_RECEIVABLE fields
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsNumber()
  invoiceAmount?: number;

  @IsOptional()
  @IsNumber()
  dueSimDay?: number;

  // PAYMENT_FAILURE fields
  @IsOptional()
  @IsNumber()
  originalAmount?: number;

  @IsOptional()
  @IsString()
  failureReason?: string;

  // PAYMENT_FAILURE: which retry (1-based) recovers. null/omitted = never recovers.
  @IsOptional()
  @IsNumber()
  succeedsOnRetryAt?: number;
}
