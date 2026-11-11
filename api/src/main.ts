import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { EnvService } from './infrastructure/env/env.service';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const env = app.get(EnvService);
  const port: number = env.apiPort;

  const config = new DocumentBuilder()
    .setTitle('Minha API')
    .setDescription('Documentação dos endpoints')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputPath = path.resolve(process.cwd(), 'swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), {
    encoding: 'utf8',
  });

  console.log(`✅ Arquivo OpenAPI gerado em: ${outputPath}`);

  SwaggerModule.setup('docs', app, document);

  await app.listen(port);

  console.log(`Reporta API is runing...`);
}
void bootstrap().catch((err) => {
  console.error('Error starting the application:', err);
  process.exit(1);
});
