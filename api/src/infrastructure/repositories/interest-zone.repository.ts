import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma';
import type {
  CreateInterestZoneData,
  InterestZoneRecord,
  GeoPoint,
} from '@/src/common/types/interest-zones.types';
import {
  INTEREST_ZONE_MAX_AREA_M2,
  INTEREST_ZONE_MAX_PER_USER,
} from '@/src/common/constants/interest-zones.constants';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from './user.repository';

interface InterestZoneRow {
  id: string;
  name: string;
  geojson: string;
  areaM2: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Persiste e valida geometrias de zonas de interesse com PostGIS. */
@Injectable()
export class InterestZoneRepository {
  /** Cria o repository de zonas de interesse.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userRepository: UserRepository,
  ) {}

  /** Valida o polígono, aplica os limites do utilizador e cria a zona atomicamente.
   * @param {string} userId proprietário da zona
   * @param {CreateInterestZoneData} data nome e pontos geográficos
   * @returns {Promise<InterestZoneRecord>} zona persistida
   * @throws {BadRequestException} se o contorno for inválido ou demasiado grande
   * @throws {ConflictException} se houver duplicação de nome ou limite excedido
   */
  async create(
    userId: string,
    data: CreateInterestZoneData,
  ): Promise<InterestZoneRecord> {
    this.validateDistinctPoints(data.points);
    const wkt = this.toPolygonWkt(data.points);
    return this.prismaService.$transaction(async (transaction) => {
      const users = await transaction.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
      );
      if (users.length === 0)
        throw new NotFoundException('Utilizador não encontrado');
      const count = await transaction.userInterestZone.count({
        where: { userId },
      });
      if (count >= INTEREST_ZONE_MAX_PER_USER)
        throw new ConflictException('Limite de 5 zonas de interesse');
      const duplicate = await transaction.userInterestZone.findFirst({
        where: { userId, name: { equals: data.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (duplicate)
        throw new ConflictException('Já existe uma zona com este nome');
      const validity = await transaction.$queryRaw<{ valid: boolean }[]>(
        Prisma.sql`SELECT ST_IsValid(ST_GeomFromText(${wkt}, 4326)) AS valid`,
      );
      if (validity[0]?.valid !== true)
        throw new BadRequestException(
          'Zona inválida: o contorno não pode cruzar-se',
        );
      const areaRows = await transaction.$queryRaw<{ areaM2: number }[]>(
        Prisma.sql`SELECT ST_Area(ST_GeogFromText(${wkt}))::float8 AS "areaM2"`,
      );
      const areaM2 = areaRows[0]?.areaM2;
      if (areaM2 === undefined)
        throw new InternalServerErrorException(
          'Não foi possível calcular a área da zona',
        );
      if (areaM2 > INTEREST_ZONE_MAX_AREA_M2)
        throw new BadRequestException('Zona demasiado grande');
      const id = randomUUID();
      const rows = await transaction.$queryRaw<InterestZoneRow[]>(Prisma.sql`
        INSERT INTO user_interest_zones (id, "userId", name, area, "createdAt", "updatedAt")
        VALUES (${id}, ${userId}, ${data.name}, ST_GeogFromText(${wkt}), now(), now())
        RETURNING id, name, ST_AsGeoJSON(area::geometry) AS geojson,
          ST_Area(area)::float8 AS "areaM2", "createdAt", "updatedAt"
      `);
      const row = rows[0];
      if (!row)
        throw new InternalServerErrorException('Não foi possível criar a zona');
      return this.toRecord(row);
    });
  }

  /** Lista até cinco zonas de um utilizador por data e id crescentes.
   * @param {string} userId proprietário das zonas
   * @returns {Promise<InterestZoneRecord[]>} zonas convertidas para coordenadas
   */
  async listByUser(userId: string): Promise<InterestZoneRecord[]> {
    const rows = await this.prismaService.$queryRaw<
      InterestZoneRow[]
    >(Prisma.sql`
      SELECT id, name, ST_AsGeoJSON(area::geometry) AS geojson,
        ST_Area(area)::float8 AS "areaM2", "createdAt", "updatedAt"
      FROM user_interest_zones WHERE "userId" = ${userId}
      ORDER BY "createdAt" ASC, id ASC
    `);
    return rows.map((row) => this.toRecord(row));
  }

  /** Renomeia uma zona sem permitir nomes duplicados no mesmo utilizador.
   * @param {string} userId proprietário da zona
   * @param {string} zoneId identificador da zona
   * @param {string} name novo nome aparado
   * @returns {Promise<InterestZoneRecord>} zona atualizada
   * @throws {NotFoundException} se a zona não pertencer ao utilizador
   * @throws {ConflictException} se o nome já existir
   */
  async rename(
    userId: string,
    zoneId: string,
    name: string,
  ): Promise<InterestZoneRecord> {
    return this.prismaService.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
      );
      const duplicate = await transaction.userInterestZone.findFirst({
        where: {
          userId,
          id: { not: zoneId },
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate)
        throw new ConflictException('Já existe uma zona com este nome');
      const rows = await transaction.$queryRaw<InterestZoneRow[]>(Prisma.sql`
        UPDATE user_interest_zones SET name = ${name}, "updatedAt" = now()
        WHERE id = ${zoneId} AND "userId" = ${userId}
        RETURNING id, name, ST_AsGeoJSON(area::geometry) AS geojson,
          ST_Area(area)::float8 AS "areaM2", "createdAt", "updatedAt"
      `);
      const row = rows[0];
      if (!row) throw new NotFoundException('Zona de interesse não encontrada');
      return this.toRecord(row);
    });
  }

  /** Apaga uma zona apenas quando pertence ao utilizador indicado.
   * @param {string} userId proprietário da zona
   * @param {string} zoneId identificador da zona
   * @returns {Promise<boolean>} true se uma linha foi apagada
   */
  async delete(userId: string, zoneId: string): Promise<void> {
    await this.userRepository.deleteInterestZone(userId, zoneId);
  }

  /** Rejeita polígonos com menos de três vértices distintos ou anel duplicado.
   * @param {GeoPoint[]} points vértices recebidos
   * @returns {void} validação concluída
   * @throws {BadRequestException} se os pontos forem insuficientes ou repetirem o fecho
   */
  private validateDistinctPoints(points: GeoPoint[]): void {
    const first = points[0];
    const last = points.at(-1);
    if (
      first &&
      last &&
      first.latitude === last.latitude &&
      first.longitude === last.longitude
    ) {
      throw new BadRequestException(
        'Não repita o primeiro ponto no fim do contorno',
      );
    }
    const distinct = new Set(
      points.map((point) => `${point.latitude},${point.longitude}`),
    );
    if (distinct.size < 3)
      throw new BadRequestException(
        'Zona inválida: são necessários três pontos distintos',
      );
  }

  /** Constrói o WKT com ordem longitude e latitude e fecha o anel no servidor.
   * @param {GeoPoint[]} points vértices sem ponto final repetido
   * @returns {string} polígono WKT no SRID 4326
   */
  private toPolygonWkt(points: GeoPoint[]): string {
    const coordinates = points.map(
      (point) => `${point.longitude} ${point.latitude}`,
    );
    const first = coordinates[0];
    return `POLYGON((${coordinates.join(', ')}, ${first ?? ''}))`;
  }

  /** Converte GeoJSON PostGIS para a representação de domínio.
   * @param {InterestZoneRow} row linha geoespacial da base de dados
   * @returns {InterestZoneRecord} zona com pontos latitude/longitude
   * @throws {InternalServerErrorException} se PostGIS devolver GeoJSON inválido
   */
  private toRecord(row: InterestZoneRow): InterestZoneRecord {
    let decoded: unknown;
    try {
      decoded = JSON.parse(row.geojson);
    } catch {
      throw new InternalServerErrorException(
        'Geometria da zona inválida na base de dados',
      );
    }
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('coordinates' in decoded) ||
      !Array.isArray(decoded.coordinates)
    ) {
      throw new InternalServerErrorException(
        'Geometria da zona inválida na base de dados',
      );
    }
    const ring = decoded.coordinates[0];
    if (!Array.isArray(ring))
      throw new InternalServerErrorException(
        'Geometria da zona inválida na base de dados',
      );
    const points: GeoPoint[] = [];
    for (const coordinate of ring.slice(0, -1)) {
      if (
        !Array.isArray(coordinate) ||
        typeof coordinate[0] !== 'number' ||
        typeof coordinate[1] !== 'number'
      ) {
        throw new InternalServerErrorException(
          'Geometria da zona inválida na base de dados',
        );
      }
      points.push({ latitude: coordinate[1], longitude: coordinate[0] });
    }
    return {
      id: row.id,
      name: row.name,
      points,
      areaM2: row.areaM2,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
