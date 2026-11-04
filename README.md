# 🚨 Urban Incident Alert API (Backend)

API backend desenvolvida em **NestJS** para uma plataforma de relatórios de incidentes urbanos com geolocalização e sistema de alertas em tempo real num raio de 1 km via Notificações Push.

---

## 🌐 Estratégia de Geolocalização e Alertas

Para evitar o rastreamento contínuo invasivo e garantir a economia de bateria dos dispositivos dos usuários:
* O app mobile utiliza **Background Geofencing Nativo** (Android/iOS) para detectar quando o usuário muda de região significativa.
* A posição enviada ao servidor representa apenas a **última localização conhecida**, minimizando dados de rastreamento armazenados.
* Ao postar um incidente classificado como de risco, a API utiliza consultas geoespaciais com `ST_DWithin` para filtrar usuários localizados a até 1 km de raio e dispara alertas **Push** imediatos via Firebase Cloud Messaging, mesmo com o aplicativo fechado.

---

## 🚀 Principais Funcionalidades

1. **Autenticação Segura:** Validação de tokens JWT gerados pelo Firebase Auth através de um *Guard* customizado no NestJS.
2. **Gestão de Localização:** Atualização pontual da posição aproximada e do `fcmToken` para o envio de alertas direcionados.
3. **Registro de Incidentes:** Postagem de ocorrências contendo título, descrição, categoria, foto e coordenadas geográficas exatas.
4. **Armazenamento de Fotos:** Upload integrado de fotos para o Supabase Storage com salvamento da URL pública no banco.
5. **Feed Cronológico de Incidentes:** Listagem de incidentes ordenados por data de criação (`createdAt DESC`), permitindo visualização geral.
6. **Alertas de Proximidade (Raio de 1 km):** Processamento espacial no Neon (PostGIS) para notificar instantaneamente os afetados mais próximos.

---

## ⚙️ Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:
* Node.js (versão 24 ou superior)
* Gerenciador de pacotes (npm, yarn ou pnpm)
* Conta no **Neon** com extensão PostGIS ativada (`CREATE EXTENSION IF NOT EXISTS postgis;`)
* Projeto no **Firebase** com o Firebase Auth e Cloud Messaging ativados
* Projeto no **Supabase** com um bucket configurado no Supabase Storage

---

## 📦 Instalação e Configuração

1. **Clone o repositório:**
   ```bash
   
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Crie um arquivo `.env` na raiz do projeto com a seguinte estrutura:

4. **Execute a geração do Prisma e as migrações:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

---

## 🏃‍♂️ Executando o Projeto

```bash
# Modo de desenvolvimento (Development)
npm run start:dev

# Build de produção
npm run build

# Executar em produção (Production)
npm run start:prod
```

---

## 👤 Autor

Desenvolvido com dedicação por **Américo Malungo Sebastião Miguel**.

Sinta-se à vontade para entrar em contato ou conectar-se através das redes sociais:

* [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](www.linkedin.com/in/americomalungo)
* [![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/americomalungo19/)

---

## 📄 Licença

Este projeto está **Sem Licença**.