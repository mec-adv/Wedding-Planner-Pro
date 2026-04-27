# Wedding Planner Pro

Aplicação web para planejamento e gestão de casamentos: múltiplos eventos por conta, convidados, lista de presentes com pagamentos, cronograma, orçamento e integrações opcionais (e-mail, **WhatsApp via Evolution API** com várias conexões por casamento, e gateway de pagamento com camada de abstração).

## Visão geral da arquitetura

O repositório é um **monorepo** gerenciado com **pnpm** (`pnpm-workspace.yaml`), organizado em pacotes em `artifacts/` (aplicações) e `lib/` (bibliotecas compartilhadas).

| Pacote | Descrição |
| -------- | ----------- |
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
- Integrações por casamento: **Evolution API** (WhatsApp: várias instâncias por evento na tabela `whatsapp_connections`), **Asaas** (PIX, boleto, cartão, etc.), configuráveis no banco
- **Multer** para upload multipart de imagens de presentes (memória + gravação em disco)

### Dados e contratos

- **PostgreSQL** (`DATABASE_URL`)
- **drizzle-kit** para aplicar o esquema (`pnpm db:push` na raiz)
- Contrato da API descrito em **OpenAPI**; geração de código com **Orval** (`lib/api-spec`)

## Novidades recentes (cadastro do casamento e loja de presentes)

- **Dados do casamento (tela “Dados do casamento”)**  
  Cadastro ampliado com: endereço do noivo e da noiva (fluxo **CEP primeiro**, consulta à [Brasil API](https://brasilapi.com.br/) com todos os campos editáveis depois); **telefone** com opção **WhatsApp**; **e-mail** de cada um; **local da cerimônia religiosa** (nome, endereço por CEP e link do Google Maps); **local da cerimônia civil** (nome e endereço). O campo legado de nome do local religioso permanece alinhado ao título “local da cerimônia religiosa” na API (`venue`). Persistência em PostgreSQL nas colunas JSONB `groom_contact`, `bride_contact`, `religious_venue_detail` e `civil_venue_detail` (migração `lib/db/drizzle/0009_wedding_contact_venues.sql`). Se o banco ainda não tiver essas colunas, rode na raiz: `pnpm run db:migrate:wedding-contact-venues` (ou `pnpm db:push` para sincronizar o esquema Drizzle).

- **Cliente HTTP no browser**  
  O `fetch` global só envia `credentials: "include"` para requisições **do mesmo origin** da SPA (ex.: `/api`), evitando falha de CORS na consulta de CEP a domínios externos.

- **Convite público (OpenAPI)**  
  O convidado no payload do convite público pode incluir **`phone`**, alinhado ao que a API já retorna.

- **Navegação**  
  Removida a opção **Checkout** do menu lateral; o fluxo de compra da lista de presentes concentra-se na **loja de presentes** (página pública do convite e checkout no contexto da loja).

- **Loja de presentes (fases recentes no repositório)**  
  Loja pública de presentes com carrinho e pagamento; **painel administrativo** de pedidos, mural de mensagens e configurações da loja; **categorias de presentes** e **cota de lua de mel**; alternância ativo/inativo de itens; integração com fluxos de pedido e notificações já existentes na API.

- **Loja pública de presentes (`/p/convite/:token/presentes`) — UX e catálogo**  
  - **Barra de progresso** (quando habilitada nas configurações da loja): exibe apenas o **percentual** da meta, sem valores absolutos em reais.  
  - **Carrossel no topo** (até **3 fotos** dos noivos): URLs configuráveis no JSON do template do convite (`shopCarouselImageUrls`) ou envio pela tela **Página do Casamento** → edição do modelo → seção **Presentes** → bloco **Carrossel da loja de presentes** (upload ou URL por slot).  
  - **Grade de presentes**: até **4 colunas** em telas largas, espaçamentos reduzidos; carrossel em **largura total** da viewport com indicadores sobre a imagem.  
  - **Paginação** do catálogo (12 itens por página) e **filtros**: busca por nome, categoria, ordenação por nome ou por valor (crescente/decrescente).  
  - **Rodapé** alinhado ao convite clássico (nomes dos noivos + linha configurável).  
  - Nos **cards**, exibição do **comentário do casal** quando preenchido no cadastro do presente (campo `humorTag` / “Comentário” na lista interna).

- **Checkout da loja (finalizar compra)**  
  - **Cotas extras para lua de mel (opcional)** antes do resumo dos itens do carrinho: cada **cota = R$ 50,00**, quantidade ajustável; o valor entra no mesmo pagamento (PIX ou cartão) e gera linha em `order_items` específica para esse adicional.  
  - **Nome e telefone (WhatsApp) obrigatórios** e **editáveis**: identificam quem efetua o pagamento (útil quando o link do convite é de um convidado e quem paga é outra pessoa). Telefone com máscara BR; pré-preenchimento a partir dos dados do convidado quando existirem.  
  - Persistência do telefone do pagador na coluna **`orders.buyer_phone`** (migração SQL `lib/db/drizzle/0008_orders_buyer_phone.sql`). Notificações por WhatsApp passam a priorizar esse número em relação ao telefone cadastrado no convidado.  
  - O **GET** do convite público (`/api/public/invite/:token`) inclui **`guest.phone`** quando cadastrado, para o pré-preenchimento no checkout.

- **Gateway de pagamento (abstração + segurança no checkout)**  
  - Camada de gateway em `artifacts/api-server/src/lib/payment-gateway/` (registry + carregamento de configuração + adaptador Asaas), preparada para múltiplos gateways no futuro (`activePaymentGateway` em `integration_settings`).  
  - Cartão de crédito no checkout público com **tokenização obrigatória via Asaas.js**; o backend recusa campos brutos de cartão e aceita apenas `creditCardToken`.  
  - Novo endpoint público de configuração de tokenização: **`GET /api/public/weddings/:weddingId/payment-config`** (gateway ativo, ambiente e `asaasPublicKey`).  
  - Fluxo de criação de pedido em duas fases (cria pedido local → chama gateway com `externalReference` no formato `wid:{weddingId}:ord:{orderId}:guest:{guestId|0}` → atualiza dados do gateway).  
  - Idempotência de checkout por header **`Idempotency-Key`**, persistido em `orders.idempotency_key`.  
  - Auditoria de status em `order_transitions` (ator, evento do gateway e timestamps), usada por polling e webhooks.

## WhatsApp e Evolution API

Integração com **Evolution API** (motor **WHATSAPP-BAILEYS**) para múltiplos números por casamento, com preparação de schema para **WhatsApp Business Cloud (Meta)** no futuro.

### Onde configurar

No app: **Configurações** (menu lateral) → aba **WhatsApp**.

### Servidor Evolution (credenciais globais por casamento)

- **Base URL** da API Evolution (sem barra no final), apontando para a raiz exposta pelo servidor.
- **API Key de administrador**: o valor configurado no próprio Evolution (em geral `AUTHENTICATION_API_KEY` no `.env` da instalação). Essa chave autentica chamadas de gerenciamento (ex.: criar instância). **Não** use a apikey retornada para uma instância já existente como se fosse chave do servidor — isso costuma resultar em `401 Unauthorized` ao criar novas instâncias.

### Conexões de WhatsApp (instâncias)

- Cada casamento pode ter **várias conexões**, armazenadas na tabela PostgreSQL **`whatsapp_connections`** (via Drizzle em `lib/db/src/schema/whatsapp_connections.ts`).
- Cada conexão tem: **provedor** (`evolution` hoje; `meta_cloud` reservado para o futuro), **dono** (`bride` = noiva, `groom` = noivo, `event` = número do evento), rótulo opcional, **nome da instância** (único por casamento na Evolution), número internacional opcional, status e **apikey específica da instância** (persistida após o retorno do `POST /instance/create` na Evolution; exibida mascarada pela API).
- Fluxo na UI: assistente em etapas (dono → dados da instância → **QR Code**), com polling de estado até conectar; ações para desconectar sessão e excluir conexão (remove também a instância na Evolution quando aplicável).

### Envio de mensagens e teste de conexão

- O envio de texto (ex.: notificações da loja) escolhe uma conexão **Evolution** conectada, priorizando **`ownerKind = event`**; em último caso usa o campo legado **`integration_settings.evolution_instance`** se ainda existir.
- O botão **Testar conexão padrão** (ao lado de salvar o servidor) usa as conexões cadastradas (prioriza dono **evento**, depois qualquer instância) para consultar o estado na Evolution; se só Base URL + API admin estiverem preenchidos e não houver instância no app, tenta validar o servidor com **`GET /instance/fetchInstances`**.

### Contrato HTTP e código gerado

- Endpoints sob `/api/weddings/:weddingId/whatsapp/...` (listar, criar, QR, status, logout, excluir) estão descritos no **OpenAPI** (`lib/api-spec/openapi.yaml`); o cliente React Query e os validadores Zod são regenerados com Orval a partir desse spec.
- Configurações de integração incluem `activePaymentGateway` e `asaasPublicKey`; cliente/validações gerados também contemplam o endpoint público `/api/public/weddings/:weddingId/payment-config`.

### Banco de dados e deploy

- O arquivo **`lib/db/drizzle.config.ts`** lista explicitamente os schemas usados pelo `drizzle-kit`; a entrada **`./src/schema/whatsapp_connections.ts`** deve estar presente para que `pnpm db:push` crie a tabela e os ENUMs no PostgreSQL.
- Migração SQL idempotente opcional: `lib/db/drizzle/0004_whatsapp_connections.sql`, aplicável com `pnpm db:migrate:whatsapp-connections` na raiz (útil se não puder usar apenas o push).
- Na subida do **api-server**, uma rotina idempotente copia `integration_settings.evolution_instance` legado para uma conexão com dono **evento**, quando fizer sentido.

## Funcionalidades (por área do produto)

- **Autenticação**: cadastro, login e rotas protegidas no app; token armazenado e enviado nas requisições.
- **Casamentos**: seleção do evento ativo, edição de dados do casamento (incluindo contatos e locais das cerimônias conforme a seção acima) e dashboard agregado.
- **Convidados**: cadastro, importação, RSVP e fluxos relacionados a convites.
- **Convites e lembretes**: envio por canais suportados (ex.: e-mail SMTP, WhatsApp quando configurado).
- **Lista de presentes**: CRUD de itens (criação e edição para cerimonialista/coordenador; exclusão apenas cerimonialista/admin); categoria opcional (“sem categoria”); campo de **comentário** (na API: `humorTag`), exibido também nos **cards da loja pública** quando preenchido; imagem via **upload** (JPEG, PNG ou WebP, limite **5 MB** por arquivo) ou **URL externa**; alternância entre visualização em **grade** e em **lista** (preferência salva no navegador por casamento). Arquivos enviados ficam fora do banco: pasta `uploads/` na raiz do monorepo (ou caminho definido por `UPLOAD_ROOT`), organizada por usuário criador do evento e identificação do casamento (`users/{id}/…-w{weddingId}/gifts/`). Imagens são servidas em **`/api/uploads`** (leitura pública, inclusive para a loja). Ao **excluir o casamento**, a pasta de uploads daquele evento é removida; ao **excluir ou trocar** um presente com imagem local, o arquivo correspondente é apagado quando aplicável.
- **Loja de presentes e pedidos**: compra pela **página pública do convite** (rota `/p/convite/:token/presentes`: carrinho, filtros, paginação, carrossel opcional, barra de progresso opcional, checkout com nome/telefone do pagador, CPF obrigatório, cotas extras de lua de mel, tokenização de cartão via Asaas.js e idempotência por requisição); **pedidos da loja** e configurações no app autenticado; integração com gateway ativo (hoje Asaas). Não há rota separada de “Checkout” no menu lateral — o fluxo de compra é pela loja.
- **Extrato**: visão financeira / movimentação ligada a presentes e pagamentos.
- **Tarefas**: checklist do planejamento com prioridade e status.
- **Orçamento**: controle de custos do evento.
- **Cronograma**: itens da programação do grande dia.
- **Fornecedores**: cadastro e acompanhamento de vendors.
- **Coordenadores**: equipe auxiliar do evento.
- **Mensagens / templates**: comunicação e modelos de mensagem.
- **Mapa de assentos**: mesas e atribuição de lugares.
- **Configurações**: preferências do casamento e integrações; abas de **WhatsApp**, **Financeiro**, **Grupos**, **Categorias** e **Páginas**. Em Financeiro, suporte a gateway ativo, chave pública do Asaas e token de webhook; em WhatsApp, servidor Evolution + múltiplas conexões por dono (noiva/noivo/evento), QR e teste da conexão padrão.
- **Webhooks**: endpoint genérico **`/api/webhooks/:gateway`** (atualmente `asaas`), com processamento assíncrono e fallback de compatibilidade para fluxo legado (`gift_orders`).

## Pré-requisitos

- [Node.js](https://nodejs.org/) compatível com o projeto
- [pnpm](https://pnpm.io/) (o `package.json` da raiz exige pnpm no `preinstall`)
- Instância **PostgreSQL** acessível pela `DATABASE_URL`

## Configuração rápida

1. **Variáveis de ambiente**  
   Copie `.env.example` para `.env` na raiz e ajuste, no mínimo, `DATABASE_URL`, `PORT` / `DEV_API_PORT` e, em produção, `JWT_SECRET`.  
   Opcional: **`UPLOAD_ROOT`** — diretório absoluto onde a API grava as imagens de presentes; se omitido, é usado `../../uploads` em relação ao diretório de trabalho do processo do `api-server` (tipicamente a pasta `uploads/` na raiz do repositório). A pasta de uploads está no **`.gitignore`** para não versionar binários.

2. **Dependências**

   ```bash
   pnpm install:deps
   ```

3. **Banco de dados** (aplica o esquema Drizzle)

   ```bash
   pnpm db:push
   ```

   Garanta que `lib/db/drizzle.config.ts` inclua todos os arquivos de schema necessários (incluindo `whatsapp_connections.ts` para a integração WhatsApp).

   Se você já tinha um banco criado antes da inclusão dos campos JSONB de contato/locais em `weddings`, aplique também a migração dedicada (idempotente):

   ```bash
   pnpm run db:migrate:wedding-contact-venues
   ```

   Para a tabela de conexões WhatsApp sem depender só do push, opcionalmente:

   ```bash
   pnpm db:migrate:whatsapp-connections
   ```

   Se o banco ainda não tiver a coluna **`buyer_phone`** em **`orders`** (checkout da loja com telefone do pagador), aplique o SQL idempotente `lib/db/drizzle/0008_orders_buyer_phone.sql` ou use `pnpm db:push` após atualizar o esquema em `lib/db`.

4. **Desenvolvimento** (API + frontend em paralelo)

   ```bash
   pnpm dev
   ```

Opcional: criação de banco em ambiente interno documentado em `scripts/create-database-sys-dev.cjs` (variáveis `PGHOST`, `PGUSER`, `PGPASSWORD` no `.env.example`).

## Scripts úteis (raiz)

| Comando | Função |
| --------- | -------- |
| `pnpm dev` | Sobe API e app web (concurrently) |
| `pnpm dev:homolog` | API + app com frontend em `BASE_PATH=/casamento360/` (atalho local de homologação) |
| `pnpm dev:homolog:local` | Alias para `pnpm dev:homolog` |
| `pnpm build` | Typecheck e build dos pacotes que expõem `build` |
| `pnpm typecheck` | Verificação TypeScript no workspace |
| `pnpm db:push` | Sincroniza esquema com o PostgreSQL |
| `pnpm db:migrate:gift-uploads` | Migração de uploads legados de presentes para arquivos em disco |
| `pnpm run db:migrate:wedding-contact-venues` | Executa SQL das colunas `groom_contact`, `bride_contact`, `religious_venue_detail`, `civil_venue_detail` em `weddings` |
| `pnpm db:migrate:whatsapp-connections` | Aplica SQL idempotente da tabela `whatsapp_connections` e ENUMs (`lib/db/drizzle/0004_whatsapp_connections.sql`) |

## Licença

MIT (conforme `package.json` da raiz).
