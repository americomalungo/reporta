# Reporta API

API REST em NestJS para registar incidentes urbanos, consultar ocorrências próximas e enviar notificações. O código da aplicação e os comandos abaixo ficam na pasta `api/`.

## Requisitos

- Node.js 24 ou superior e Yarn (o repositório inclui `api/yarn.lock`).
- PostgreSQL com as extensões PostGIS e `pg_trgm` disponíveis.
- Projeto Firebase com Authentication e Cloud Messaging.
- Armazenamento privado compatível com S3, como Backblaze B2.
- Credenciais do serviço Observe.

## Configuração

Na pasta `api/`, crie um arquivo `.env` com:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://utilizador:senha@host:5432/reporta
OBSERVE_APP_KEY=...
OBSERVE_APP_SECRET=...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=...
STORAGE_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
STORAGE_REGION=eu-central-003
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_BUCKET=...
JOBS_ENABLED=true
```

Use o endpoint e a região indicados pelo seu fornecedor S3. O bucket deve ser privado. `JOBS_ENABLED=false` desativa as rotinas agendadas, mas não os endpoints administrativos de manutenção.

## Instalar e executar

```bash
cd api
yarn install --frozen-lockfile
yarn generate
yarn migrate:dev
yarn start:dev
```

Em desenvolvimento, a documentação Swagger está disponível em `/docs`. As migrações incluem a configuração das extensões espaciais; confirme que o seu servidor PostgreSQL permite PostGIS antes de as aplicar.

Para produção, compile e aplique as migrações antes de iniciar:

```bash
yarn generate
yarn build
yarn migrate:prod
yarn start:prod
```

`GET /users` usa paginação por cursor: envie `limit` (máximo 50) e depois o `nextCursor` devolvido na página anterior.

## Funcionalidades

- Verificação de tokens Firebase e autorização por função.
- Registo, moderação e gestão de contas e zonas de interesse.
- Incidentes geolocalizados, feed paginado, comentários e votos.
- Upload de imagens convertidas para WebP e servidas por URLs assinadas.
- Alertas de risco por proximidade e notificações in-app/push.
- Rotinas agendadas para expiração, retenção e limpeza de dados.

## Testes e lint

Na pasta `api/`, use `yarn test`, `yarn test:e2e` e `yarn lint`.

## Licença

Este projeto não declara uma licença de utilização. Consulte o autor antes de redistribuir ou incorporar o código.
