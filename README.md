# Wedding Planner Pro

Aplicação web para planejamento e gestão de casamentos: múltiplos eventos por conta, convidados, lista de presentes com pagamentos, cronograma, orçamento e integrações opcionais (e-mail, WhatsApp e gateway de pagamento).

## Visão geral da arquitetura

O repositório é um **monorepo** gerenciado com **pnpm** (`pnpm-workspace.yaml`), organizado em pacotes em `artifacts/` (aplicações) e `lib/` (bibliotecas compartilhadas).

| Pacote | Descrição |
|--------|-----------|
| `@workspace/wedding-app` | SPA em React (Vite), interface do planejador |
| `@workspace/api-server` | API REST em Express, autenticação e regras de negócio |
| `@workspace/db` | Esquema e migrações com Drizzle ORM + PostgreSQL |
| `@workspace/api-client-react` | Cliente HTTP tipado + hooks React Query (gerado a partir do OpenAPI) |
| `@workspace/api-zod` | Schemas Zod alinhados à API (gerado) |
| `@workspace/api-spec` | Especificação OpenAPI e configuração **Orval** para regenerar cliente e validadores |

O frontend consome a API em `/api` (em desenvolvimento, o proxy do Vite usa `DEV_API_PORT` alinhado ao `PORT` do servidor).

## Tecnologias principais

### Frontend (`wedding-app`)

- **React 19** e **TypeScript**
- **Vite 7** como bundler e servidor de desenvolvimento
- **Tailwind CSS 4** e componentes **Radix UI** (padrão “shadcn-like”)
- **Wouter** para roteamento
- **TanStack Query** para cache e chamadas à API
- **React Hook Form** + **Zod** para formulários
- **Zustand** para estado local
- **date-fns**, **Recharts**, **Framer Motion**, **@hello-pangea/dnd** (entre outras libs de UI e dados)

### Backend (`api-server`)

- **Express 5** (JSON, CORS)
- **Drizzle ORM** com driver **pg** (PostgreSQL)
- Autenticação com **JWT** (Bearer) e **bcryptjs** para senhas
- **Nodemailer** para envio de convites por e-mail (SMTP via variáveis de ambiente)
- Integrações por casamento: **Evolution API** (WhatsApp), **Asaas** (PIX, boleto, cartão, etc.), configuráveis no banco

### Dados e contratos

- **PostgreSQL** (`DATABASE_URL`)
- **drizzle-kit** para aplicar o esquema (`pnpm db:push` na raiz)
- Contrato da API descrito em **OpenAPI**; geração de código com **Orval** (`lib/api-spec`)

## Funcionalidades (por área do produto)

- **Autenticação**: cadastro, login e rotas protegidas no app; token armazenado e enviado nas requisições.
- **Casamentos**: seleção do evento ativo, edição de dados do casamento e dashboard agregado.
- **Convidados**: cadastro, importação, RSVP e fluxos relacionados a convites.
- **Convites e lembretes**: envio por canais suportados (ex.: e-mail SMTP, WhatsApp quando configurado).
- **Lista de presentes e checkout**: pedidos, métodos de pagamento e integração com Asaas quando habilitada.
- **Extrato**: visão financeira / movimentação ligada a presentes e pagamentos.
- **Tarefas**: checklist do planejamento com prioridade e status.
- **Orçamento**: controle de custos do evento.
- **Cronograma**: itens da programação do grande dia.
- **Fornecedores**: cadastro e acompanhamento de vendors.
- **Coordenadores**: equipe auxiliar do evento.
- **Mensagens / templates**: comunicação e modelos de mensagem.
- **Mapa de assentos**: mesas e atribuição de lugares.
- **Configurações**: preferências do casamento e integrações (SMTP, Evolution, Asaas, etc.).
- **Webhooks**: endpoints para eventos externos (ex.: confirmação de pagamento).

## Pré-requisitos

- [Node.js](https://nodejs.org/) compatível com o projeto
- [pnpm](https://pnpm.io/) (o `package.json` da raiz exige pnpm no `preinstall`)
- Instância **PostgreSQL** acessível pela `DATABASE_URL`

## Configuração rápida

1. **Variáveis de ambiente**  
   Copie `.env.example` para `.env` na raiz e ajuste, no mínimo, `DATABASE_URL`, `PORT` / `DEV_API_PORT` e, em produção, `JWT_SECRET`.

2. **Dependências**

   ```bash
   pnpm install:deps
   ```

3. **Banco de dados** (aplica o esquema Drizzle)

   ```bash
   pnpm db:push
   ```

4. **Desenvolvimento** (API + frontend em paralelo)

   ```bash
   pnpm dev
   ```

Opcional: criação de banco em ambiente interno documentado em `scripts/create-database-sys-dev.cjs` (variáveis `PGHOST`, `PGUSER`, `PGPASSWORD` no `.env.example`).

## Scripts úteis (raiz)

| Comando | Função |
|---------|--------|
| `pnpm dev` | Sobe API e app web (concurrently) |
| `pnpm build` | Typecheck e build dos pacotes que expõem `build` |
| `pnpm typecheck` | Verificação TypeScript no workspace |
| `pnpm db:push` | Sincroniza esquema com o PostgreSQL |

## Licença

MIT (conforme `package.json` da raiz).
