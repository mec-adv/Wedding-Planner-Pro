import type { PaymentGateway, PaymentGatewayName } from "./types";
import { AsaasGateway } from "./adapters/asaas";

const registry = new Map<PaymentGatewayName, PaymentGateway>();

function registerGateway(adapter: PaymentGateway): void {
  registry.set(adapter.name, adapter);
}

export function getGateway(name: PaymentGatewayName): PaymentGateway {
  const adapter = registry.get(name);
  if (!adapter) throw new Error(`Gateway de pagamento não suportado: ${name}`);
  return adapter;
}

// Register built-in adapters
registerGateway(new AsaasGateway());
