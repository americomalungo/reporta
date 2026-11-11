import { Body, Controller, Delete, Param, Put } from '@nestjs/common';
import type { User } from '@/generated/prisma';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import { VoteIncidentDto } from '../dto/vote-incident.dto';
import { VotesService } from '../services/votes.service';

@Controller('incidents/:incidentId/vote')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Put()
  vote(
    @Param('incidentId') incidentId: string,
    @Body() dto: VoteIncidentDto,
    @CurrentDbUser() user: User,
  ) {
    return this.votesService.vote(incidentId, user, dto);
  }

  @Delete()
  removeVote(
    @Param('incidentId') incidentId: string,
    @CurrentDbUser() user: User,
  ) {
    return this.votesService.removeVote(incidentId, user);
  }
}
