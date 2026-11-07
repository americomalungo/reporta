import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { EnvService } from './config/env/env.service';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const configService = app.get(EnvService);

  const port: number = configService.apiPort;

  await app.listen(port);

  console.log(`Reporta API is runing...`);
}
void bootstrap().catch((err) => {
  console.error('Error starting the application:', err);
  process.exit(1);
});
