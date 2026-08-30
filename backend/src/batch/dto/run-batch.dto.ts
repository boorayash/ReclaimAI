import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RunBatchDto {
  // How many instances of each named scenario template to create.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  countPerTemplate?: number;
}
