import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { fetchAddressByCep, formatCepDisplay, onlyCepDigits } from "@/lib/brasil-cep";
import { useToast } from "@/hooks/use-toast";

export type AddressSlice = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

type Props = {
  value: AddressSlice;
  onChange: (next: AddressSlice) => void;
  idPrefix: string;
};

export function AddressCepFields({ value, onChange, idPrefix }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const patch = (partial: Partial<AddressSlice>) => {
    onChange({ ...value, ...partial });
  };

  const lookupWithDigits = async (digits: string) => {
    if (digits.length !== 8) {
      toast({ variant: "destructive", title: "Informe um CEP com 8 dígitos" });
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAddressByCep(digits);
      if (!data) {
        toast({ variant: "destructive", title: "CEP não encontrado", description: "Verifique o número ou preencha manualmente." });
        return;
      }
      patch({
        cep: formatCepDisplay(data.cep.replace(/\D/g, "")),
        street: data.street ?? value.street,
        neighborhood: data.neighborhood ?? value.neighborhood,
        city: data.city ?? value.city,
        state: data.state ?? value.state,
      });
      toast({ title: "Endereço preenchido a partir do CEP" });
    } finally {
      setLoading(false);
    }
  };

  const runLookup = () => void lookupWithDigits(onlyCepDigits(value.cep ?? ""));

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium mb-1" htmlFor={`${idPrefix}-cep`}>
            CEP
          </label>
          <Input
            id={`${idPrefix}-cep`}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={value.cep ?? ""}
            onChange={(e) => patch({ cep: formatCepDisplay(onlyCepDigits(e.target.value)) })}
            onBlur={(e) => {
              const d = onlyCepDigits(e.target.value);
              if (d.length === 8) void lookupWithDigits(d);
            }}
          />
        </div>
        <Button type="button" variant="secondary" className="shrink-0" disabled={loading} onClick={runLookup}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
          Buscar CEP
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" htmlFor={`${idPrefix}-street`}>
            Logradouro
          </label>
          <Input
            id={`${idPrefix}-street`}
            value={value.street ?? ""}
            onChange={(e) => patch({ street: e.target.value })}
            autoComplete="street-address"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${idPrefix}-number`}>
            Número
          </label>
          <Input id={`${idPrefix}-number`} value={value.number ?? ""} onChange={(e) => patch({ number: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${idPrefix}-complement`}>
            Complemento
          </label>
          <Input
            id={`${idPrefix}-complement`}
            value={value.complement ?? ""}
            onChange={(e) => patch({ complement: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${idPrefix}-neighborhood`}>
            Bairro
          </label>
          <Input
            id={`${idPrefix}-neighborhood`}
            value={value.neighborhood ?? ""}
            onChange={(e) => patch({ neighborhood: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${idPrefix}-city`}>
            Cidade
          </label>
          <Input id={`${idPrefix}-city`} value={value.city ?? ""} onChange={(e) => patch({ city: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${idPrefix}-state`}>
            UF
          </label>
          <Input
            id={`${idPrefix}-state`}
            value={value.state ?? ""}
            onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
            className="uppercase"
          />
        </div>
      </div>
    </div>
  );
}
