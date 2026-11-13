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
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=reporta
TRUST_PROXY_HOPS=0
```

Use o endpoint e a região indicados pelo seu fornecedor S3. O bucket deve ser privado. `JOBS_ENABLED=false` desativa workers e agendamentos neste processo; a API continua a poder colocar jobs em fila.

## Valkey/Redis

### Desenvolvimento local

Inicie Valkey localmente com a política exigida pelo BullMQ:

```bash
docker run --rm -p 6379:6379 valkey/valkey valkey-server --maxmemory-policy noeviction
```

Configure `REDIS_URL=redis://localhost:6379` para a API executada na máquina host. Se a API estiver noutro container, use o nome do serviço Valkey na rede Docker em vez de `localhost`.

### Filas, cache e rate limits

O serviço Valkey deve usar obrigatoriamente `maxmemory-policy noeviction`, requisito do BullMQ para impedir a remoção de chaves internas das filas. Em produção, configure `REDIS_URL` com o URI `rediss://` fornecido pelo serviço Aiven; a ligação TLS é ativada pelo URI. `REDIS_KEY_PREFIX` (padrão `reporta`) separa chaves de cache, rate limit e BullMQ. `TRUST_PROXY_HOPS` (padrão `0`) só deve ser aumentado quando a API estiver atrás de um número conhecido de proxies confiáveis.

As filas `alerts`, `moderation` e `maintenance` processam alertas de risco, pushes, moderação automática e manutenção. Os jobs periódicos são sincronizados ao iniciar a aplicação quando `JOBS_ENABLED=true`. Se Valkey estiver indisponível, a avaliação de moderação após um voto negativo pode atrasar até cinco minutos, até o job periódico `retry-auto-moderation` voltar a processá-la. Com `JOBS_ENABLED=false`, não são criados workers nem agendamentos, mas os pedidos ainda podem ser aceites e enfileirados por outro processo ativo.

O rate limit padrão é 120 pedidos por minuto por utilizador autenticado ou IP. Os limites específicos são: criação de incidentes 10/10 minutos, upload de fotos 20/10 minutos, comentários 30/minuto, votos 60/minuto e endpoints administrativos 60/minuto. Se Valkey estiver indisponível, o rate limit permite o pedido e regista um aviso.

A cache guarda a lista pública de categorias ativas durante 10 minutos e é invalidada quando uma categoria é criada ou editada. Falhas de cache são tratadas como cache miss.

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
- Filas BullMQ para alertas, moderação e manutenção, com agendamentos configuráveis.

## Testes e lint

Na pasta `api/`, use `yarn test`, `yarn test:e2e` e `yarn lint`.

## Licença

Este projeto não declara uma licença de utilização. Consulte o autor antes de redistribuir ou incorporar o código.
