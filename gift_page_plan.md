# Plano de Desenvolvimento — Loja de Presentes v2.0
**Wedding Planner Pro | PRD v2.0 | Abril 2026**

---

## Contexto

O PRD v2.0 especifica o módulo completo de Loja de Presentes: catálogo público, carrinho, checkout com PIX e cartão de crédito parcelado, Cota de Lua de Mel, Barra de Progresso Global, Mural de Mensagens, gestão de pedidos no painel admin, cancelamento/estorno, exportação e QR Code do convite.

A entrega depende criticamente de duas integrações que **existem parcialmente no código** mas ainda não foram completadas e testadas de ponta a ponta: **Asaas** (pagamentos) e **Evolution API** (WhatsApp). O modelo de pedidos atual (`giftOrdersTable`) é simples (1 pedido = 1 presente), enquanto o PRD exige um modelo relacional completo (`orders` + `order_items`).

---

## Premissa Confirmada

> **Sim, está correto.** As integrações com Evolution API e Asaas devem ser desenvolvidas e testadas como **pré-requisito obrigatório** antes do desenvolvimento do módulo da Loja de Presentes, pois todo o fluxo de checkout, confirmação e notificação depende delas funcionando corretamente.

---

## Estado Atual das Integrações (descoberto no codebase)

| Componente | Arquivo | Status |
|---|---|---|
| Asaas — PIX e boleto | `artifacts/api-server/src/lib/asaas.ts` | Parcialmente implementado |
| Asaas — Cartão com parcelas | `artifacts/api-server/src/lib/asaas.ts` | Parcialmente implementado |
| Asaas — Estorno/cancelamento | `artifacts/api-server/src/lib/asaas.ts` | A verificar/implementar |
| Asaas — Webhook handler | `artifacts/api-server/src/routes/webhooks.ts` | Parcialmente implementado |
| Evolution API — envio de mensagem | `artifacts/api-server/src/lib/evolution-api.ts` | Parcialmente implementado |
| Configuração por casamento (DB) | `lib/db/src/schema/settings.ts` | Implementado |
| UI de configuração das integrações | `artifacts/wedding-app/src/` | Implementado |

---

## Arquivos Críticos a Modificar/Criar

### Backend
- `artifacts/api-server/src/lib/asaas.ts` — completar fluxos (cartão tokenizado, estorno)
- `artifacts/api-server/src/lib/evolution-api.ts` — template de mensagem pós-compra
- `artifacts/api-server/src/routes/webhooks.ts` — adaptar para novo modelo de orders
- `artifacts/api-server/src/routes/gifts.ts` — adicionar toggle active, categorias, honeymoon fund
- `artifacts/api-server/src/routes/index.ts` — registrar novas rotas
- Novas rotas: `orders.ts`, `mural-messages.ts`, `gift-categories.ts`

### Banco de Dados
- `lib/db/src/schema/gifts.ts` — adicionar `is_honeymoon_fund`
- `lib/db/src/schema/weddings.ts` — adicionar `show_progress_bar`, `progress_goal`, `thank_you_message`
- Novas tabelas: `orders`, `order_items`, `mural_messages`, `gift_categories`
- Migrações em `lib/db/drizzle/`

### Frontend
- `artifacts/wedding-app/src/pages/public/PublicInvite.tsx` — integrar loja
- Novos componentes da loja pública (catálogo, carrinho, checkout)
- Novas páginas admin (gestão de pedidos, mural, config da loja)

---

## Fases de Desenvolvimento

---

### FASE 0 — Validação e Conclusão das Integrações (PRÉ-REQUISITO)
**Objetivo:** Garantir que Asaas e Evolution API funcionam de ponta a ponta antes de qualquer feature da loja.

#### 0A — Asaas
1. Auditar `asaas.ts`: mapear o que está implementado vs o que falta
2. Implementar/validar fluxo PIX completo:
   - `POST /payments` com `billingType: PIX`
   - Retorno do QR Code (base64) + código copia-e-cola
   - Configuração de expiração via `PIX_EXPIRATION_SECONDS`
3. Implementar/validar fluxo Cartão de Crédito:
   - Tokenização via Asaas.js (frontend nunca envia dados crus ao servidor)
   - `POST /payments` com `billingType: CREDIT_CARD`, `creditCardToken`, `installmentCount`
   - Resposta imediata: CONFIRMED / DECLINED / PENDING
4. Implementar fluxo de Estorno:
   - `DELETE /payments/:id` ou `POST /payments/:id/cancel`
   - Tratamento de erro quando Asaas rejeitar
5. Validar webhook handler:
   - Autenticação por `asaas-access-token` header
   - Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`
   - Idempotência: ignorar evento duplicado
6. Variáveis de ambiente: verificar `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT`, `ASAAS_WEBHOOK_TOKEN`, `PIX_EXPIRATION_SECONDS`

#### 0B — Evolution API (WhatsApp)
1. Auditar `evolution-api.ts`: validar `sendWhatsAppMessage()`
2. Garantir envio assíncrono (não bloqueia response)
3. Implementar template mínimo da mensagem pós-compra (especificado na seção 3.8 do PRD):
   - Saudação + nome do convidado
   - Confirmação da compra + nome dos noivos + data
   - Lista de itens com quantidade e valor
   - Total e forma de pagamento (com parcelas quando cartão)
   - Mensagem de agradecimento configurável
4. Garantir que falha no envio registra log e não reverte status do pedido

#### 0C — Testes das Integrações
- Testar PIX em ambiente sandbox: criação, exibição do QR Code, polling, webhook confirmando
- Testar Cartão em ambiente sandbox: tokenização, aprovação, recusa
- Testar Estorno: pedido paid → estorno → refunded
- Testar WhatsApp: envio real com número de teste
- **Gate:** só avançar para Fase 1 após todas as integrações testadas com sucesso

---

### FASE 1 — Fundação: Banco de Dados e Migrações
**Objetivo:** Criar o novo modelo de dados que suporta todos os requisitos do PRD v2.0.

#### 1A — Ajustes em tabelas existentes
1. `gifts` — adicionar colunas:
   - `is_honeymoon_fund: boolean default false`
   - (verificar se `isActive` já existe — sim, existe)
2. `weddings` — adicionar colunas:
   - `show_progress_bar: boolean default false`
   - `progress_goal: numeric(12,2) nullable`
   - `thank_you_message: text nullable`
3. `gift_categories` (nova tabela) se não existir:
   - `id`, `wedding_id`, `name`, `sort_order`, `active`, `created_at`

#### 1B — Novas tabelas
4. `orders` — pedidos de presentes (substitui uso direto de `gift_orders` para o novo fluxo):
   - Todos os campos especificados na seção 3.6 do PRD
   - Status enum: `pending | paid | failed | expired | refunded | cancelled`
   - Campos: `buyer_name`, `asaas_payment_id`, `asaas_status`, `mural_message`, `whatsapp_sent_at`, `email_sent_at`, `paid_at`, `cancelled_at`, `cancelled_by`
5. `order_items` — itens de cada pedido:
   - `gift_name_snapshot`, `unit_price_snapshot` (preservar histórico)
   - `quantity`, `subtotal`
6. `mural_messages` — mensagens avulsas e do checkout:
   - `source enum: checkout | public_page`
   - `order_id nullable`

#### 1C — Scripts de migração
- Criar arquivos SQL em `lib/db/drizzle/` para cada alteração
- Atualizar schema TypeScript em `lib/db/src/schema/`
- Executar e validar migrações em ambiente de dev

**Verificação:** Todas as tabelas criadas, constraints corretas, sem breaking changes no sistema existente.

---

### FASE 2 — Backend: APIs do Módulo Loja
**Objetivo:** Implementar todas as rotas novas especificadas na seção 9.1 do PRD.

#### 2A — Rotas públicas (sem autenticação, validadas por token do convidado)
1. `GET /api/public/weddings/:wId/gifts` — lista presentes ativos (incluindo Cota de Lua de Mel)
2. `GET /api/public/weddings/:wId/gift-categories` — categorias para filtro
3. `GET /api/public/weddings/:wId/shop-settings` — configurações da loja (barra de progresso, meta, mensagem de agradecimento)
4. `POST /api/public/orders` — criar pedido + gerar pagamento no Asaas
   - Validar token do convidado
   - Criar `orders` + `order_items` em transação atômica
   - Chamar Asaas para PIX ou cartão conforme selecionado
   - Retornar QR Code (PIX) ou status (cartão)
5. `GET /api/public/orders/:orderId/status` — polling de status (PIX)
6. `GET /api/public/orders?guestToken=:token` — histórico de pedidos do convidado
7. `POST /api/public/mural-messages` — mensagem avulsa na página pública
8. `POST /api/webhooks/asaas` — atualizar para usar novo modelo `orders`
   - Validar `ASAAS_WEBHOOK_TOKEN`
   - Atualizar status do pedido
   - Disparar WhatsApp (Evolution API) e e-mail após paid
   - Idempotência: ignorar se já paid

#### 2B — Rotas admin (autenticadas)
9. `GET /api/weddings/:wId/orders` — listagem paginada e filtrável
10. `GET /api/weddings/:wId/orders/:orderId` — detalhe com itens e log
11. `GET /api/weddings/:wId/orders/summary` — resumo financeiro (total paid, pending, ticket médio)
12. `POST /api/weddings/:wId/orders/:orderId/cancel` — estorno via Asaas (restrito a admin/cerimonialista)
13. `GET /api/weddings/:wId/orders/export` — exportação XLSX/CSV (paid + pending)
14. `GET /api/weddings/:wId/mural-messages` — listagem do mural com filtros
15. `GET /api/weddings/:wId/guests/:gId/qrcode` — QR Code do convite (PNG/SVG)
16. `PATCH /api/weddings/:wId/gifts/:giftId/active` — ativar/inativar presente

#### 2C — Configurações da loja no painel admin
17. Estender `PUT /api/weddings/:wId/settings` ou criar endpoint dedicado para:
    - `show_progress_bar`, `progress_goal`, `thank_you_message`

**Verificação:** Testar cada endpoint com cURL/Insomnia. Testar fluxo completo: criar pedido PIX → webhook confirma → status muda para paid → WhatsApp disparado.

---

### FASE 3 — Frontend: Loja Pública (Página do Convidado)
**Objetivo:** Implementar a experiência completa do convidado em `/p/convite/:token`.

#### 3A — Catálogo de Presentes
1. Componente de grid de cards de presentes
   - Campos: imagem, nome, categoria, descrição resumida, valor, botão "Adicionar ao Carrinho"
   - Badge/checkmark para presentes já comprados na sessão
2. Card especial para Cota de Lua de Mel (`is_honeymoon_fund = true`) com destaque visual
3. Filtro por categoria (chips ou dropdown) + opção "Todas as Categorias"
4. Busca por nome em tempo real (client-side)
5. Ordenação: padrão, menor preço, maior preço, nome A-Z
6. Modal de detalhe do presente (imagem ampliada, descrição completa, `humorTag`, seletor de quantidade)
7. Barra de Progresso Global (exibida quando configurada e ativada)

#### 3B — Cota de Lua de Mel
8. Modal de detalhe com campo de valor livre
9. Validação: mínimo R$ 50,00 com mensagem de erro
10. Pode ser adicionada ao carrinho múltiplas vezes

#### 3C — Carrinho de Compras
11. Ícone persistente no header com badge de quantidade
12. Drawer lateral com lista de itens, quantidades, subtotais, total geral
13. Ações: alterar quantidade, remover item
14. Sugestões de presentes complementares (até 3 da mesma categoria)
15. Botão "Finalizar Compra"
16. Persistência via `sessionStorage` (zerado ao concluir ou fechar aba)

#### 3D — Checkout
17. Identificação do comprador (nome pré-preenchido, editável; telefone exibido não editável)
18. Campo de mensagem para o Mural (opcional, limite 500 chars)
19. Seleção de forma de pagamento: PIX ou Cartão
20. PIX: exibir QR Code + código copia-e-cola + temporizador de validade
21. Cartão: formulário com tokenização Asaas.js (nunca enviar dados crus)
    - Campos: número, nome, validade, CVV, CPF, parcelas (1-12x)
    - Exibir valor por parcela calculado em tempo real
22. Polling de status PIX a cada 5 segundos
23. Tela de sucesso: número do pedido, resumo, instrução
24. Tratamento de PIX expirado e cartão recusado com mensagens claras

#### 3E — Histórico de Pedidos do Convidado (`/p/convite/:token/pedidos`)
25. Lista de pedidos em ordem cronológica decrescente
26. Expandir pedido: ver itens, quantidade, subtotal
27. Para PIX pendente e válido: exibir QR Code para retomada

#### 3F — Mural de Mensagens (seção na página pública)
28. Campo de nome (pré-preenchido, editável) + campo de mensagem
29. Envio imediato (sem vínculo com pedido)
30. Limite de 500 caracteres

**Verificação:** Testar fluxo completo no browser (mobile + desktop): escolher presente → carrinho → checkout PIX → confirmar pagamento no sandbox → status muda → notificação WhatsApp recebida.

---

### FASE 4 — Frontend: Painel Administrativo
**Objetivo:** Dar ao organizador visibilidade e controle total dos pedidos.

#### 4A — Gestão de Pedidos (`/weddings/:wId/orders`)
1. Tabela paginada: número, data/hora, comprador, status, forma de pagamento, parcelas, total
2. Filtros combináveis: status, forma de pagamento, período, nome do comprador
3. Modal de detalhe: dados do comprador, itens, total, ID Asaas, log de status, mensagem do mural
4. Link direto para o pagamento no painel do Asaas
5. Botão de cancelamento/estorno (restrito a admin/cerimonialista) com modal de confirmação
6. Resumo financeiro no topo: total arrecadado, total pendente, total de pedidos, ticket médio
7. Botão de exportação XLSX/CSV

#### 4B — Mural de Mensagens (`/weddings/:wId/mural`)
8. Lista cronológica decrescente: nome, data/hora, origem, conteúdo
9. Link para pedido quando origem = checkout
10. Filtros por origem (todos/compra/página pública) e período

#### 4C — Configurações da Loja (extensão da tela de settings)
11. Toggle: exibir Barra de Progresso
12. Campo: valor da meta (obrigatório quando toggle ativo)
13. Campo: mensagem de agradecimento dos noivos

#### 4D — QR Code do Convite
14. Botão "Download QR Code" na página de cadastro do convidado
15. Opções: PNG e SVG

**Verificação:** Testar cancelamento/estorno de pedido paid no sandbox. Verificar que Asaas confirma antes de mudar status. Testar exportação com filtros aplicados.

---

### FASE 5 — Complementos ao Catálogo Admin
**Objetivo:** Fechar as funcionalidades administrativas do catálogo de presentes.

1. Gestão de categorias de presentes: CRUD com nome e ordem de exibição
2. Toggle ativo/inativo no card de presente (sem exclusão, mantém histórico)
3. Indicador de unidades vendidas no cadastro do presente
4. Cadastro da Cota de Lua de Mel: campo `is_honeymoon_fund`, título e descrição configuráveis

**Verificação:** Inativar um presente e confirmar que não aparece na loja pública. Verificar que histórico de pedidos do presente inativo é preservado.

---

### FASE 6 — Notificações e E-mail de Confirmação
**Objetivo:** Garantir que todas as notificações pós-compra funcionam corretamente.

1. Validar template completo do WhatsApp (todos os campos da seção 3.8 do PRD)
2. Implementar e-mail de confirmação de compra:
   - Canal: SMTP existente no sistema (`artifacts/api-server/src/lib/email.ts`)
   - Conteúdo: resumo do pedido, itens, total, forma de pagamento, mensagem de agradecimento
   - Se sem e-mail cadastrado: ignorar sem erro crítico
   - Registrar `email_sent_at` no pedido
3. Garantir que ambas notificações são disparadas apenas após `status = paid`
4. Garantir envio assíncrono (não bloqueia response ao frontend)
5. Registrar `whatsapp_sent_at` e `email_sent_at` no pedido

**Verificação:** Concluir um pagamento completo de ponta a ponta e confirmar recebimento de WhatsApp e e-mail com conteúdo correto.

---

## Resumo das Fases

| Fase | Descrição | Gate de Aprovação |
|---|---|---|
| **Fase 0** | Validar e completar integrações Asaas + Evolution API | Ambas testadas com sucesso em sandbox |
| **Fase 1** | Migrações de banco de dados | Todas as tabelas criadas sem erros |
| **Fase 2** | APIs backend do módulo loja | Todos os endpoints testados |
| **Fase 3** | Frontend da loja pública | Fluxo completo no browser (mobile + desktop) |
| **Fase 4** | Frontend do painel admin | Gestão de pedidos e estorno funcionando |
| **Fase 5** | Complementos ao catálogo admin | Ativo/inativo e categorias funcionando |
| **Fase 6** | Notificações WhatsApp e e-mail | Notificações recebidas após pagamento confirmado |

---

## Variáveis de Ambiente a Configurar

```bash
# Asaas
ASAAS_API_KEY=<chave da conta RGR Services>
ASAAS_ENVIRONMENT=sandbox   # trocar para production no go-live
ASAAS_WEBHOOK_TOKEN=<token para validar webhooks>
PIX_EXPIRATION_SECONDS=1800  # opcional, padrão 30 minutos

# Já existentes no sistema
DATABASE_URL=...
JWT_SECRET=...
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM=...
```

**Nota:** Configurações de Evolution API (URL, API Key, Instance) e Asaas são configuradas por casamento no painel de Settings, armazenadas na tabela `integration_settings`.