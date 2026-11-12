import { Injectable } from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import type {
  CreateInterestZoneData,
  InterestZoneRecord,
} from '@/src/common/types/interest-zones.types';
import { InterestZoneRepository } from '@/src/infrastructure/repositories/interest-zone.repository';
import { CreateInterestZoneDto } from './dto/create-interest-zone.dto';
import { UpdateInterestZoneDto } from './dto/update-interest-zone.dto';

/** Coordena as operações de zonas de interesse do utilizador autenticado. */
@Injectable()
export class InterestZonesService {
  /** Cria o serviço de zonas de interesse.
   * @param {InterestZoneRepository} repository operações geoespaciais
   */
  constructor(private readonly repository: InterestZoneRepository) {}

  /** Cria uma zona validada do utilizador autenticado.
   * @param {User} user proprietário autenticado
   * @param {CreateInterestZoneDto} dto nome e vértices
   * @returns {Promise<InterestZoneRecord>} zona criada
   */
  create(user: User, dto: CreateInterestZoneDto): Promise<InterestZoneRecord> {
    const data: CreateInterestZoneData = {
      name: dto.name,
      points: dto.points.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    };
    return this.repository.create(user.id, data);
  }

  /** Lista as zonas do utilizador autenticado por ordem de criação.
   * @param {User} user proprietário autenticado
   * @returns {Promise<InterestZoneRecord[]>} zonas guardadas
   */
  list(user: User): Promise<InterestZoneRecord[]> {
    return this.repository.listByUser(user.id);
  }

  /** Altera apenas o nome de uma zona pertencente ao utilizador.
   * @param {User} user proprietário autenticado
   * @param {string} zoneId identificador da zona
   * @param {UpdateInterestZoneDto} dto novo nome
   * @returns {Promise<InterestZoneRecord>} zona atualizada
   */
  rename(
    user: User,
    zoneId: string,
    dto: UpdateInterestZoneDto,
  ): Promise<InterestZoneRecord> {
    return this.repository.rename(user.id, zoneId, dto.name);
  }

  /** Apaga uma zona do utilizador autenticado.
   * @param {User} user proprietário autenticado
   * @param {string} zoneId identificador da zona
   * @returns {Promise<{ message: string }>} confirmação da remoção
   */
  async remove(user: User, zoneId: string): Promise<{ message: string }> {
    await this.repository.delete(user.id, zoneId);
    return { message: 'Zona removida' };
  }
}
