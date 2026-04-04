# Casamento360 - Wedding Management Platform

## Overview

Full-stack wedding management web application (Casamento360) built for wedding planners/cerimonialistas. All UI is in Brazilian Portuguese (pt-BR) with an elegant romantic style using soft rose/gold accents.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **State**: Zustand (auth store), React Query (server state)
- **Auth**: JWT (bcryptjs + jsonwebtoken), stored in localStorage, wedding ownership verification middleware
- **Payments**: Asaas gateway (PIX, boleto, credit card)
- **Messaging**: Evolution API (WhatsApp integration)

## Role System

Internal role names map to Portuguese labels in the UI:
- `admin` → "Administrador"
- `planner` → "Cerimonialista" (wedding planner)
- `coordinator` → "Coordenador(a)"
- `couple` → "Casal"
- `guest` → "Convidado(a)"

The `ROLE_LABELS` constant in both `auth.ts` (backend) and `AppLayout.tsx` (frontend) provides the mapping.

## Features

- **Role-based auth**: admin, planner (cerimonialista), coordinator, couple, guest
- **RBAC on all endpoints**: Each GET/POST/PATCH/DELETE route enforces role-based access via `requireWeddingRole()`
- **Guest management**: RSVP tracking, invite sending (WhatsApp/email), import, search/filter
- **Gift registry**: image upload (JPEG/PNG/WebP, 5 MB) or external URL, stored under `uploads/` (or `UPLOAD_ROOT`) by user/event; public `/api/uploads`; files removed when wedding or gift is deleted; grid/list view; optional category and comment field; Asaas checkout (PIX/boleto/card) and webhooks for payment status
- **Financial extract**: Transaction history with withdrawal status tracking (pending → available → withdrawn)
- **Automatic reminders**: Scheduled RSVP reminders via WhatsApp (configurable interval, start/stop/send-now)
- **Task management**: Kanban board with drag-and-drop, priorities, due dates
- **Vendor management**: CRUD for wedding vendors with pricing
- **Coordinator management**: Team management with granular permissions
- **Wedding day schedule**: Sortable timeline of events
- **Budget control**: Categories + items, estimated vs actual costs, paid tracking, summary
- **Interactive seating chart**: Tables with drag-and-drop seat assignments
- **Guest messages gallery**: Public message submission, admin moderation
- **Message templates**: Reusable WhatsApp message templates
- **Bulk WhatsApp sending**: Send messages to multiple guests at once
- **Admin integration settings**: Configure Asaas and Evolution API per wedding
- **Dashboard**: Summary stats, upcoming tasks, recent messages, countdown

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   │   ├── src/routes/     # auth, weddings, guests, gifts, tasks, vendors,
│   │   │                   # coordinators, schedule, budget, seating, messages,
│   │   │                   # settings, dashboard, webhooks, reminders
│   │   └── src/lib/        # auth.ts, asaas.ts, evolution-api.ts
│   └── wedding-app/        # React + Vite frontend (previewPath /)
│       ├── src/pages/      # auth, dashboard, guests, gifts, tasks, budget, schedule, weddings,
│       │                   # vendors, coordinators, messages, settings, seating
│       ├── src/components/  # ui/ (shadcn), layout/
│       └── src/hooks/      # use-auth.ts, use-toast.ts
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/     # users, weddings, guests, gifts, tasks, vendors,
│                           # coordinators, schedule, budget, seating, messages, settings
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Database Schema

12 schema files with tables:
- `users` - user accounts with role-based access
- `weddings` - wedding events with bride/groom info
- `guests` - guest list with RSVP status, phone, email, group
- `gifts` / `gift_orders` - gift registry items and payment orders (Asaas integration), includes `withdrawalStatus` and `withdrawnAt` fields
- `tasks` - task management with status, priority, assignee
- `vendors` - wedding vendors with category and pricing
- `coordinators` - wedding coordination team
- `schedule_items` - wedding day timeline
- `budget_categories` / `budget_items` - budget tracking by category
- `seating_tables` / `seat_assignments` - seating chart
- `messages` / `message_templates` - guest messages and WhatsApp templates
- `integration_settings` - per-wedding Asaas and Evolution API configuration

## API Endpoints

All routes prefixed with `/api/`:
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET|POST /weddings`, `GET|PATCH|DELETE /weddings/:id`
- `GET|POST /weddings/:weddingId/guests`, guest RSVP, invite sending, import
- `GET|POST /weddings/:weddingId/gifts`, gift orders, order summary
- `PATCH /weddings/:weddingId/gift-orders/:orderId/withdrawal` - withdrawal status management
- `GET|POST /weddings/:weddingId/tasks`, CRUD with status/priority
- `GET|POST /weddings/:weddingId/vendors`, vendor CRUD
- `GET|POST /weddings/:weddingId/coordinators`, coordinator CRUD
- `GET|POST /weddings/:weddingId/schedule`, schedule item CRUD
- Budget categories + items CRUD, budget summary
- Seating tables + seat assignments CRUD
- Messages CRUD, message templates CRUD, bulk WhatsApp sending
- Integration settings GET/PUT, test WhatsApp/Asaas connections
- Dashboard summary endpoint
- `POST /webhooks/asaas` - Asaas payment webhook
- `GET /weddings/:weddingId/reminders/status` - check reminder status
- `POST /weddings/:weddingId/reminders/start` - start auto reminders
- `POST /weddings/:weddingId/reminders/stop` - stop auto reminders
- `POST /weddings/:weddingId/reminders/send-now` - send reminders immediately

## RBAC Matrix

| Resource | GET | POST/PATCH | DELETE |
|---|---|---|---|
| guests | planner, coordinator | planner, coordinator | planner |
| tasks | planner, coordinator | planner, coordinator | planner |
| vendors | planner, coordinator | planner, coordinator | planner |
| coordinators | planner, coordinator | planner | planner |
| budget | planner | planner | planner |
| seating | planner, coordinator | planner, coordinator | planner |
| gift-orders | planner | public (checkout) | - |
| messages | all roles | all roles | planner, coordinator |
| message-templates | planner, coordinator | planner, coordinator | planner |
| schedule | all roles | planner, coordinator | planner |
| gifts (registry) | public | planner, coordinator | planner |
| reminders | planner, coordinator | planner | planner |

Admin role bypasses all checks.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck; actual JS by esbuild/tsx/vite

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`

## Development

- **Tudo junto (API + Vite com proxy `/api`):** na raiz, `pnpm dev` **ou** `npm run dev` (após instalar dependências) — abre `http://localhost:5173` (API em `PORT` do `.env`, normalmente 8080).

### Windows: `pnpm` não encontrado no PowerShell

1. Instale dependências **sem** pnpm global: `npm run install:deps` (equivale a `npx pnpm@9 install`).
2. Suba API + front: `npm run dev`.
3. **Opcional:** instalar pnpm no PATH — `npm install -g pnpm` ou `corepack enable` + `corepack prepare pnpm@latest --activate` — depois use `pnpm install` / `pnpm dev` normalmente.

### Instalação “travada” ou muito lenta (`Progress: … added 0`)

Repositório em **Google Drive / OneDrive / pasta de rede** (`I:\Meu Drive\...`): o pnpm cria milhares de links; o sync pode travar por **horas** ou parecer congelado.

**Recomendado:** clone o projeto em uma pasta **local** (ex.: `C:\dev\Wedding-Planner-Pro`), copie o `.env`, e rode `npm run install:deps` de lá.

- [`pnpm-workspace.yaml`](pnpm-workspace.yaml): `nodeLinker: hoisted`, `packageImportMethod: copy`.
- [`.npmrc`](.npmrc): **`inject-workspace-packages=true`** — injeta pacotes `@workspace/*` como cópia em vez de symlink (evita `EISDIR` no Drive).

O `npm` pode avisar que não reconhece `inject-workspace-packages` no `.npmrc`; pode ignorar.

Após mudanças, apague `node_modules` na raiz e em `artifacts/*` / `lib/*` se existirem, depois `npm run install:deps`.

Se já tiver rodado `install:deps` antes de mudar o `.npmrc`, apague só a pasta `node_modules` (mantenha `pnpm-lock.yaml`) e rode `npm run install:deps` de novo.

- API Server: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/wedding-app run dev` (defina `PORT` e `BASE_PATH`, ex.: `PORT=5173` e `BASE_PATH=/`)
- DB Push: `pnpm --filter @workspace/db run push` ou `npm run db:push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`

## Important Notes

- `api-zod/src/index.ts` must export ONLY `./generated/api` (not `./generated/types`) to avoid duplicate export errors — orval regeneration resets this, must fix after every codegen run
- Numeric DB fields stored as strings, converted with `Number()` in routes
- Date fields preprocessed string→Date before Zod validation
- The `integrationSettingsTable` (not `settingsTable`) is the correct table name
- Settings GET masks secrets; PUT skips masked values

## Key Integrations

### Asaas (Payment Gateway)
- Sandbox: `https://sandbox.asaas.com/api/v3`
- Production: `https://api.asaas.com/v3`
- Webhook: `POST /api/webhooks/asaas`
- Configured per wedding in integration_settings table

### Evolution API (WhatsApp)
- `POST /message/sendText/{instance}` with `apikey` header
- Configured per wedding in integration_settings table
