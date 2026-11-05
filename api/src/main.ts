import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { EnvService } from './config/env/env.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  const configService = app.get(EnvService);

  const port: number = configService.apiPort;

  await app.listen(port);

  console.log(`Reporta API is runing...`);
  
}
void bootstrap().catch((err) => {
  console.error('Error starting the application:', err);
  process.exit(1);
});
