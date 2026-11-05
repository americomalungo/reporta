import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './config/database/prisma.service';
@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}
  @Get()
  getHello(): string {
    return 'Reporta API is running...!';
  }
}
