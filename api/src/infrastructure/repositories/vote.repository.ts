import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Vote, VoteType } from '@/generated/prisma';
import { isPrismaError } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resultado do processamento de um voto num incidente.
 */
export interface VoteResult {
  /**
   * Voto atual do utilizador após o processamento.
   */
  myVote: VoteType | null;
  /**
   * Total de confirmações após a operação.
   */
  confirmCount: number;
  /**
   * Total de desconfirmações após a operação.
   */
  disconfirmCount: number;
}

/**
 * Repositório responsável pela persistência e atualização dos votos dos utilizadores.
 */
@Injectable()
export class VoteRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Busca o voto do utilizador num incidente específico.
   * @param {string} incidentId id do incidente
   * @param {string} userId id do utilizador
   * @returns {Promise<Vote | null>} voto encontrado ou null
   */
  async findByIncidentAndUser(
    incidentId: string,
    userId: string,
  ): Promise<Vote | null> {
    return this.prismaService.vote.findUnique({
      where: {
        incidentId_userId: {
          incidentId,
          userId,
        },
      },
    });
  }

  /**
   * Busca todos os votos de um utilizador num conjunto de incidentes.
   * @param {string} userId id do utilizador
   * @param {string[]} incidentIds lista dos ids dos incidentes
   * @returns {Promise<Vote[]>} lista de votos relevantes
   */
  async findManyByUser(userId: string, incidentIds: string[]): Promise<Vote[]> {
    if (incidentIds.length === 0) {
      return [];
    }

    return this.prismaService.vote.findMany({
      where: {
        userId,
        incidentId: {
          in: incidentIds,
        },
      },
    });
  }

  /**
   * Regista ou altera o voto de um utilizador num incidente.
   * @param {string} incidentId id do incidente
   * @param {string} userId id do utilizador
   * @param {VoteType} type tipo do voto
   * @returns {Promise<VoteResult>} voto atual e contadores da operação
   * @throws {ConflictException} se a concorrência colidir na restrição única
   */
  async setVote(
    incidentId: string,
    userId: string,
    type: VoteType,
  ): Promise<VoteResult> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const existingVote = await tx.vote.findUnique({
          where: {
            incidentId_userId: {
              incidentId,
              userId,
            },
          },
        });

        const incident = await tx.incident.findUnique({
          where: { id: incidentId },
          select: {
            confirmCount: true,
            disconfirmCount: true,
          },
        });

        if (!incident) {
          throw new NotFoundException('Incidente não encontrado');
        }

        if (!existingVote) {
          await tx.vote.create({
            data: {
              incidentId,
              userId,
              type,
            },
          });

          const updateData: Prisma.IncidentUpdateInput =
            type === VoteType.CONFIRM
              ? { confirmCount: { increment: 1 } }
              : { disconfirmCount: { increment: 1 } };

          const updatedIncident = await tx.incident.update({
            where: { id: incidentId },
            data: updateData,
            select: {
              confirmCount: true,
              disconfirmCount: true,
            },
          });

          return {
            myVote: type,
            confirmCount: updatedIncident.confirmCount,
            disconfirmCount: updatedIncident.disconfirmCount,
          };
        }

        if (existingVote.type === type) {
          return {
            myVote: existingVote.type,
            confirmCount: incident.confirmCount,
            disconfirmCount: incident.disconfirmCount,
          };
        }

        const updateData: Prisma.IncidentUpdateInput = {};

        if (existingVote.type === VoteType.CONFIRM) {
          updateData.confirmCount = { decrement: 1 };
        } else {
          updateData.disconfirmCount = { decrement: 1 };
        }

        if (type === VoteType.CONFIRM) {
          updateData.confirmCount = { increment: 1 };
        } else {
          updateData.disconfirmCount = { increment: 1 };
        }

        const updatedVote = await tx.vote.updateMany({
          where: {
            incidentId,
            userId,
            type: existingVote.type,
          },
          data: {
            type,
          },
        });

        if (updatedVote.count === 0) {
          throw new ConflictException('Voto em processamento, tente novamente');
        }

        const updatedIncident = await tx.incident.update({
          where: { id: incidentId },
          data: updateData,
          select: {
            confirmCount: true,
            disconfirmCount: true,
          },
        });

        return {
          myVote: type,
          confirmCount: updatedIncident.confirmCount,
          disconfirmCount: updatedIncident.disconfirmCount,
        };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Incidente não encontrado');
      }
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Voto em processamento, tente novamente');
      }
      throw error;
    }
  }

  /**
   * Remove o voto do utilizador num incidente.
   * @param {string} incidentId id do incidente
   * @param {string} userId id do utilizador
   * @returns {Promise<VoteResult>} voto removido e contadores finais
   * @throws {NotFoundException} se o utilizador ainda não tiver votado
   */
  async removeVote(incidentId: string, userId: string): Promise<VoteResult> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const existingVote = await tx.vote.findUnique({
          where: {
            incidentId_userId: {
              incidentId,
              userId,
            },
          },
        });

        if (!existingVote) {
          throw new NotFoundException('Ainda não votou neste incidente');
        }

        const deletedVote = await tx.vote.deleteMany({
          where: {
            incidentId,
            userId,
            type: existingVote.type,
          },
        });

        if (deletedVote.count === 0) {
          throw new ConflictException('Voto em processamento, tente novamente');
        }

        const updateData: Prisma.IncidentUpdateInput =
          existingVote.type === VoteType.CONFIRM
            ? {
                confirmCount: { decrement: 1 },
              }
            : {
                disconfirmCount: { decrement: 1 },
              };

        const updatedIncident = await tx.incident.update({
          where: { id: incidentId },
          data: updateData,
          select: {
            confirmCount: true,
            disconfirmCount: true,
          },
        });

        return {
          myVote: null,
          confirmCount: updatedIncident.confirmCount,
          disconfirmCount: updatedIncident.disconfirmCount,
        };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Incidente não encontrado');
      }
      throw error;
    }
  }
}
