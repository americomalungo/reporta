import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
/** Dados para restringir publicações. */
export class RestrictPostingDto {
  /** Motivo da restrição. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 500)
  reason: string;
  /** Duração em dias, 30 por omissão. */
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(365) days?: number =
    30;
}
