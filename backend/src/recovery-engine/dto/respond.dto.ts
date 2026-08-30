import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export class RespondDto {
  @IsEnum(['PROMISE_TO_PAY', 'DISPUTE', 'PARTIAL_PAYMENT', 'ALREADY_PAID'])
  responseType: 'PROMISE_TO_PAY' | 'DISPUTE' | 'PARTIAL_PAYMENT' | 'ALREADY_PAID';

  // PROMISE_TO_PAY
  @IsOptional()
  @IsNumber()
  promisedAmount?: number;

  @IsOptional()
  @IsNumber()
  promisedBySimDay?: number;

  // PARTIAL_PAYMENT
  @IsOptional()
  @IsNumber()
  partialAmount?: number;
}