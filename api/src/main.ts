import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { EnvService } from './infrastructure/env/env.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const env = app.get(EnvService);
  const port: number = env.apiPort;

  if (!env.isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Reporta API')
      .setDescription(
        'API do Reporta: alertas colaborativos de incidentes urbanos',
      )
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token de ID do Firebase',
      })
      .addSecurityRequirements('bearer')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);

  logger.log('Reporta API a correr...');
}
void bootstrap().catch((err) => {
  logger.error('Erro ao iniciar a aplicação:', err);
  process.exit(1);
});
