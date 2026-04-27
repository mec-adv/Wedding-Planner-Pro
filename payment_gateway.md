# Plano: Integração com Gateway de Pagamento (Asaas + Abstração Multi-Gateway)

## Contexto

O sistema já possui estrutura parcial de pagamento (tabelas `orders`/`order_items`, integração Asaas, checkout frontend), mas a implementação tem lacunas críticas de segurança e rastreabilidade, e está acoplada diretamente ao Asaas sem camada de abstração. Este plano endereça todos os pontos necessários para o pleno funcionamento do pagamento com segurança e controle.

**Decisões aprovadas:**
- Tokenização obrigatória via Asaas.js (remover dados brutos de cartão do backend)
- `externalReference` completo: `wid:{X}:ord:{Y}:guest:{Z}`
- Tabela de audit log `order_transitions`
- Migração faseada do sistema legado `gift_orders`

---

## Fase 1 — Banco de Dados (Migração)

**Arquivo de migração:** `lib/db/drizzle/0010_payment_gateway_abstraction.sql`

### 1.1 — Renomear colunas gateway-específicas em `orders`

```sql
ALTER TABLE orders RENAME COLUMN asaas_payment_id TO gateway_payment_id;
ALTER TABLE orders RENAME COLUMN asaas_status TO gateway_status;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway varchar(30) DEFAULT 'asaas';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key varchar(128);

DROP INDEX IF EXISTS orders_asaas_payment_id_idx;
CREATE INDEX IF NOT EXISTS orders_gateway_payment_id_idx
  ON orders (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
```

### 1.2 — Adicionar discriminador de gateway em `integration_settings`

```sql
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS active_payment_gateway varchar(30) DEFAULT 'asaas';
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS asaas_public_key text;  -- chave pública para Asaas.js (tokenização)
```

### 1.3 — Nova tabela de audit log `order_transitions`

```sql
CREATE TABLE IF NOT EXISTS order_transitions (
  id            serial PRIMARY KEY,
  order_id      integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status   varchar(20),
  to_status     varchar(20) NOT NULL,
  gateway_event varchar(100),
  actor         varchar(50) NOT NULL,  -- 'gateway_webhook', 'polling', 'admin:{userId}', 'system'
  note          text,
  created_at    timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS order_transitions_order_id_idx ON order_transitions (order_id);
```

### 1.4 — Drizzle Schema Updates

- **`lib/db/src/schema/orders.ts`**: Renomear `asaasPaymentId` → `gatewayPaymentId`, `asaasStatus` → `gatewayStatus`; adicionar `paymentGateway`, `idempotencyKey`; exportar nova `orderTransitionsTable`
- **`lib/db/src/schema/settings.ts`**: Adicionar `activePaymentGateway`, `asaasPublicKey`
- **`lib/db/src/schema/index.ts`**: Exportar `orderTransitionsTable`

---

## Fase 2 — Camada de Abstração de Gateway

### 2.1 — Estrutura de arquivos

```
artifacts/api-server/src/lib/payment-gateway/
  types.ts           ← interfaces TypeScript puras (PaymentGateway, inputs/results)
  registry.ts        ← mapa de adaptadores; getGateway(name)
  load-config.ts     ← carrega GatewayConfig da integration_settings por weddingId
  adapters/
    asaas/
      index.ts           ← AsaasGateway implements PaymentGateway
      customer.ts        ← findOrCreateCustomer (extraído de asaas.ts)
      normalize-status.ts ← mapeia status Asaas → normalizado (paid|pending|failed|...)
      webhook-parser.ts  ← verifyAndParseWebhook para Asaas
```

### 2.2 — Interface `PaymentGateway` (`types.ts`)

```typescript
export type PaymentGatewayName = "asaas"; // extensível: | "stripe" | "mercado_pago"

export interface PaymentGateway {
  readonly name: PaymentGatewayName;
  testConnection(config: GatewayConfig): Promise<{ success: boolean; message: string }>;
  createPixPayment(config, input: CreatePixPaymentInput): Promise<PixPaymentResult>;
  createCreditCardPayment(config, input: CreateCreditCardPaymentInput): Promise<CreditCardPaymentResult>;
  getPaymentStatus(config, gatewayPaymentId: string): Promise<PaymentStatusResult>;
  cancelPayment(config, gatewayPaymentId: string): Promise<void>;
  verifyAndParseWebhook(config, headers, rawBody: Buffer): Promise<WebhookParseResult>;
}
```

Inputs e results são gateway-agnósticos. `CreateCreditCardPaymentInput` aceita **somente `creditCardToken`** (sem campos de cartão bruto — jamais).

### 2.3 — `externalReference` (rastreabilidade no Asaas)

Formato obrigatório em todas as cobranças criadas no Asaas:
```
wid:{weddingId}:ord:{orderId}:guest:{guestId|0}
```
Gerado no `shop.ts` **após** criar o registro do pedido no banco (para ter o `orderId`).

### 2.4 — Criação de pedido em duas fases (necessário para `externalReference`)

```
1. INSERT orders (status='pending', gatewayPaymentId=null) → obtém orderId
2. Chama gateway com externalReference contendo orderId
3. UPDATE orders SET gatewayPaymentId, gatewayStatus
4. Se gateway falhar → UPDATE orders SET status='failed'
```

### 2.5 — `registry.ts`

```typescript
const registry = new Map<PaymentGatewayName, PaymentGateway>();
export function registerGateway(adapter: PaymentGateway): void { ... }
export function getGateway(name: PaymentGatewayName): PaymentGateway { ... }
// Registro automático ao importar o módulo:
import { AsaasGateway } from "./adapters/asaas";
registerGateway(new AsaasGateway());
```

---

## Fase 3 — Backend: Atualização de Rotas

### 3.1 — `artifacts/api-server/src/routes/shop.ts`

**Mudanças:**
- Remover `cardNumber`, `cardHolderName`, `cardExpiryMonth`, `cardExpiryYear`, `cardCcv` do Zod schema
- Adicionar validação: se `paymentMethod === 'credit_card'` e `creditCardToken` ausente → HTTP 400
- Usar `loadGatewayConfig(weddingId)` + `getGateway(config.gatewayName)` no lugar das chamadas diretas ao Asaas
- Implementar criação em duas fases (§2.4)
- Registrar transições em `order_transitions` a cada mudança de status
- Ler `Idempotency-Key` do header; checar duplicatas antes de criar o pedido
- Renomear todas as referências `asaasPaymentId` → `gatewayPaymentId`, `asaasStatus` → `gatewayStatus`

**Novo endpoint público:**
```
GET /public/weddings/:weddingId/payment-config
→ { gatewayName: "asaas", asaasPublicKey: "...", asaasEnvironment: "sandbox"|"production" }
```
Retorna apenas a chave pública (segura para expor ao frontend). Rate limited.

### 3.2 — `artifacts/api-server/src/routes/webhooks.ts`

**Mudanças:**
- Novo path: `POST /webhooks/:gateway` (ex: `/webhooks/asaas`)
- Ajuste em `app.ts`: aplicar `express.raw()` antes do `express.json()` para `/api/webhooks/*` (necessário para verificação de assinatura)
- Dispatcher: `getGateway(params.gateway)` → `gateway.verifyAndParseWebhook(...)`
- Estratégia de lookup por token (sem weddingId na URL): `AsaasGateway.findConfigByWebhookToken(token)` consulta `integration_settings WHERE asaas_webhook_token = $token`
- Usar `applyOrderTransition(orderId, normalizedStatus, gatewayEvent, actor)` — função compartilhada que atualiza `orders.status` e insere em `order_transitions`
- Manter fallback para `gift_orders` quando `orders` não encontrar (migração faseada)
- Rate limiting: 60 req/min por IP em `/api/webhooks/*`
- Sempre retornar `{ received: true }` HTTP 200 independente do resultado (prevenir enumeração)

### 3.3 — `artifacts/api-server/src/routes/settings.ts`

**Mudanças:**
- `GET` e `PUT` `/weddings/:weddingId/settings`: incluir `activePaymentGateway` e `asaasPublicKey` (sem mascaramento — é pública)
- Mascarar `asaasPublicKey` apenas se for API key completa (verificar tipo de campo)
- `POST .../test-asaas`: refatorar para usar `gateway.testConnection(config)`
- Adicionar campo `asaasPublicKey` ao Zod schema de atualização

---

## Fase 4 — OpenAPI e Geração de Clientes

**Arquivo:** `lib/api-spec/openapi.yaml`

Adicionar nos schemas `IntegrationSettings` e `IntegrationSettingsInput`:
```yaml
activePaymentGateway:
  type: string
  enum: [asaas]
asaasPublicKey:
  type: string
  nullable: true
```

Adicionar schema `PaymentConfig` e endpoint `GET /public/weddings/{weddingId}/payment-config`.

**Após editar o spec:**
```bash
pnpm orval   # ou comando equivalente para regenerar lib/api-client-react e lib/api-zod
```

---

## Fase 5 — Frontend

### 5.1 — `artifacts/wedding-app/src/pages/settings/Settings.tsx`

Na aba "Financeiro":
- Adicionar campo "Chave Pública Asaas" (`asaasPublicKey`) — necessária para tokenização no checkout
- Adicionar seletor de gateway (`activePaymentGateway`) — atualmente só "Asaas"; estrutura preparada para outros
- Incluir `activePaymentGateway` e `asaasPublicKey` nas mutations de save/load

### 5.2 — `artifacts/wedding-app/src/pages/public/shop/ShopCheckoutDialog.tsx`

**Mudança crítica: tokenização via Asaas.js**

1. Antes de renderizar o formulário de cartão, chamar `GET /public/weddings/:weddingId/payment-config` para obter `asaasPublicKey` e `asaasEnvironment`
2. Carregar dinamicamente o script Asaas.js (CDN: sandbox ou produção conforme `environment`)
3. No `handleCardSubmit`, em vez de coletar `cardNumber`/`cardCcv` no estado React:
   - Usar refs no formulário HTML (não state — evitar re-renders com dados sensíveis)
   - Chamar `AsaasJs.tokenize({ cardNumber, expiryMonth, expiryYear, cvv, holderName })` → retorna `creditCardToken`
   - Limpar os valores dos campos imediatamente após tokenização
   - Enviar apenas `{ creditCardToken, holderName, holderCpf, holderEmail, holderPhone, holderPostalCode, holderAddressNumber, installments }` para o backend
4. **Remover do estado React:** `cardNumber`, `cardExpiry`, `cardCvv` (nunca armazenar em state)
5. Adicionar `Idempotency-Key` (UUID v4 gerado no início do checkout) ao header da requisição `POST /public/orders`

### 5.3 — `artifacts/wedding-app/src/lib/shop-api.ts`

- Renomear `asaasPaymentId` → `gatewayPaymentId` nas interfaces `GuestOrder` e `OrderStatusResult`
- Adicionar função `fetchPaymentConfig(weddingId)` para obter chave pública + environment

---

## Fase 6 — Migração Faseada do Sistema Legado

### Fase 6.1 (este escopo) — Deprecação

- Adicionar comentário `/** @deprecated Use /public/orders instead */` em `gifts.ts` nas rotas de gift-orders
- Manter webhook fallback para `gift_orders` em `webhooks.ts`
- Nenhuma rota nova ou mudança de comportamento

### Fase 6.2 (follow-up, escopo separado)

- Avaliar se algum casamento ativo ainda usa o fluxo legado
- Script de migração de dados `gift_orders` → `orders`/`order_items`
- Desativar rotas legadas

---

## O que NÃO alterar

| Arquivo | Motivo |
|---|---|
| `artifacts/api-server/src/lib/asaas.ts` | O adaptador Asaas vai encapsulá-lo; manter íntegro |
| `artifacts/api-server/src/lib/create-gift-order.ts` | Pertence ao sistema legado; apenas renomear refs |
| `artifacts/api-server/src/routes/gifts.ts` | Sistema legado; apenas comentário @deprecated |
| `artifacts/api-server/src/lib/evolution-api.ts` | WhatsApp não afetado |
| `artifacts/api-server/src/lib/email.ts` | Não afetado |
| Lógica de mural/mensagens | Funciona corretamente; mudanças apenas nos blocos de transação que também mudam status |

---

## Segurança — Checklist

| Risco | Mitigação |
|---|---|
| Dados brutos de cartão | Removidos do schema Zod e do estado React; tokenização via Asaas.js obrigatória |
| Logging de dados sensíveis | Nunca logar `config.apiKey`; guard explícito no adaptador |
| Webhook brute-force | Rate limit 60/min por IP; resposta sempre HTTP 200 (sem vazamento via status) |
| Pagamentos duplicados | `Idempotency-Key` header + unique index `orders.idempotency_key` |
| Chave API exposta | `loadGatewayConfig` é o único ponto que lê a chave; chave pública separada para frontend |
| Rastreabilidade de fraudes | `order_transitions` com `actor` + `gateway_event` + timestamp imutável |

---

## Verificação End-to-End

1. **Configurar** casamento no painel: aba Financeiro → informar `asaasApiKey`, `asaasPublicKey`, `asaasWebhookToken`, ambiente sandbox → testar conexão
2. **Checkout PIX**: acessar convite público → adicionar presente ao carrinho → finalizar → selecionar PIX → escanear QR code no app bancário → confirmar que status muda para "pago"
3. **Checkout Cartão**: mesmo fluxo → selecionar Cartão → inserir dados → confirmar tokenização (network tab: payload não deve conter `cardNumber`) → confirmar pagamento imediato
4. **Webhook**: simular evento `PAYMENT_CONFIRMED` do Asaas → verificar que `orders.status` = `paid` e `order_transitions` tem registro com `actor = 'gateway_webhook'`
5. **Pedidos da Loja** (admin): verificar que o pedido aparece com `wid:X:ord:Y:guest:Z` como referência
6. **Idempotência**: enviar mesma requisição de checkout 2x com mesmo `Idempotency-Key` → segundo retorno deve ser 200 com o pedido existente, sem nova cobrança no Asaas
7. **Estorno**: cancelar pedido pago via admin → verificar refund no Asaas + transição `paid→refunded` em `order_transitions`

---

## Ordem de Implementação

1. Migração SQL (`0010_payment_gateway_abstraction.sql`)
2. Drizzle schema (`orders.ts`, `settings.ts`, `index.ts`)
3. Renomear referências `asaasPaymentId` → `gatewayPaymentId` em todo o backend (busca global)
4. Criar módulo `payment-gateway/` (types → registry → load-config → adaptador Asaas)
5. Atualizar `shop.ts` (abstração, duas fases, idempotência, externalReference, transições)
6. Atualizar `webhooks.ts` (dispatcher genérico, raw body, fallback legacy)
7. Atualizar `settings.ts` (activePaymentGateway, asaasPublicKey, test-gateway)
8. Editar `openapi.yaml` → rodar `pnpm orval` → commit dos gerados
9. Atualizar `Settings.tsx` (seletor gateway + campo asaasPublicKey)
10. Atualizar `ShopCheckoutDialog.tsx` (Asaas.js tokenização, remover raw card state)
11. Atualizar `shop-api.ts` (renomear interfaces)
12. Comentários @deprecated em `gifts.ts` (legado)

---

## Arquivos Críticos

| Arquivo | Tipo de Mudança |
|---|---|
| `lib/db/src/schema/orders.ts` | Renomear campos, adicionar paymentGateway, idempotencyKey, orderTransitionsTable |
| `lib/db/src/schema/settings.ts` | Adicionar activePaymentGateway, asaasPublicKey |
| `artifacts/api-server/src/lib/payment-gateway/` | Novo módulo (criar) |
| `artifacts/api-server/src/routes/shop.ts` | Abstração, tokenização, externalReference, idempotência, transições |
| `artifacts/api-server/src/routes/webhooks.ts` | Dispatcher genérico, raw body |
| `artifacts/api-server/src/routes/settings.ts` | activePaymentGateway, asaasPublicKey |
| `artifacts/api-server/src/index.ts` | raw body middleware para /api/webhooks/* |
| `lib/api-spec/openapi.yaml` | Novos campos e endpoint payment-config |
| `artifacts/wedding-app/src/pages/settings/Settings.tsx` | Seletor gateway, campo asaasPublicKey |
| `artifacts/wedding-app/src/pages/public/shop/ShopCheckoutDialog.tsx` | Asaas.js tokenização |
| `artifacts/wedding-app/src/lib/shop-api.ts` | Renomear interfaces |