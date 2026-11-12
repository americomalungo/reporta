import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Dados para alterar apenas o nome de uma zona existente. */
export class UpdateInterestZoneDto {
  /** Novo nome aparado da zona. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 60)
  name: string;
}
