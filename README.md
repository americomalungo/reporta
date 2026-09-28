# Reporta — Plataforma Municipal de Crowdsourcing

A Reporta é uma plataforma municipal cívica que permite reportar incidentes urbanos (buracos, iluminação avariada, inundações, etc.), acompanhar o estado das ocorrências na sua cidade e receber alertas de proximidade sobre incidentes.

## Propósito

Capacitar cidadãos a relatar incidentes urbanos (buracos, iluminação danificada, acidentes, etc.) com localização geográfica precisa, fotos e confirmação comunitária, enquanto administradores podem gerenciar categorias, validar relatórios e tomar ações preventivas baseadas em dados.

## Funcionalidades Principais

- **Reportagem de Incidentes** — Criar reports com localização GPS, fotos, categoria e descrição
- **Confirmação Comunitária** — Usuários confirmam reports para aumentar credibilidade
- **Alertas de Proximidade** — Notificações automáticas baseadas em raio geoespacial (PostGIS)
- **Notificações Multi-Canal** — Email, Push (FCM/APNs) e in-app
- **Autenticação Segura** — JWT com refresh tokens rotacionados por dispositivo
- **Painel Administrativo** — Gerenciar categorias, suspender usuários, visualizar logs de auditoria
- **Dispositivos Multi-Sessão** — Fingerprinting de dispositivos com controle de sessões
- **Auditoria Imutável** — Registro completo de todas as ações do sistema

## Contribuindo

1. Crie uma branch para sua feature: `git checkout -b feature/sua-feature`
2. Commit suas mudanças: `git commit -am 'Adiciona nova feature'`
3. Push para a branch: `git push origin feature/sua-feature`
4. Abra um Pull Request

### Padrões de Código

- TypeScript strict mode
- Nomenclatura em inglês e português
- Máximo 80 caracteres por linha
- Testes para lógica crítica
- ESLint + Prettier obrigatório

## Licença

UNLICENSED — Projeto privado

## Contato

- **Autor** — Américo Malungo Sebastião Miguel
- **Instagram** — [@\_americomalungo](https://www.instagram.com/_americomalungo?igsh=MnFybWxidW9uNnJ5)
- **LinkedIn** — [Américo Malungo](https://www.linkedin.com/in/am%C3%A9rico-malungo-b66208338?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app)

---
