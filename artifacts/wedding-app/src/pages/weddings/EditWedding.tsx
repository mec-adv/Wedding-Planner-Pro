import { useParams, Link } from "wouter";
import { useGetWedding, useUpdateWedding, ApiError, getGetWeddingQueryKey } from "@workspace/api-client-react";
import type { PersonContact, VenueDetail } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Scale, Church, Copy } from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";
import { AddressCepFields, type AddressSlice } from "@/components/wedding/AddressCepFields";

/** Valor para input datetime-local no fuso local */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function emptyPerson(): PersonContact {
  return {
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    phone: "",
    phoneHasWhatsapp: false,
    email: "",
  };
}

function mergePerson(p?: PersonContact | null): PersonContact {
  return { ...emptyPerson(), ...p, phoneHasWhatsapp: p?.phoneHasWhatsapp ?? false };
}

function emptyVenue(): VenueDetail {
  return {
    name: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    mapsUrl: "",
  };
}

function mergeVenue(v?: VenueDetail | null, legacyVenueName?: string | null): VenueDetail {
  return {
    ...emptyVenue(),
    ...v,
    name: v?.name?.trim() ? v.name : legacyVenueName ?? "",
  };
}

function personToAddressSlice(p: PersonContact): AddressSlice {
  return {
    cep: p.cep,
    street: p.street,
    number: p.number,
    complement: p.complement,
    neighborhood: p.neighborhood,
    city: p.city,
    state: p.state,
  };
}

function venueToAddressSlice(v: VenueDetail): AddressSlice {
  return {
    cep: v.cep,
    street: v.street,
    number: v.number,
    complement: v.complement,
    neighborhood: v.neighborhood,
    city: v.city,
    state: v.state,
  };
}

export default function EditWedding() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { data, isLoading, error } = useGetWedding(wid, {
    query: {
      queryKey: getGetWeddingQueryKey(wid),
      enabled: Number.isFinite(wid) && wid > 0,
    },
  });
  const updateMutation = useUpdateWedding();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [groomName, setGroomName] = useState("");
  const [brideName, setBrideName] = useState("");
  const [civil, setCivil] = useState("");
  const [religious, setReligious] = useState("");
  const [description, setDescription] = useState("");

  const [groomContact, setGroomContact] = useState<PersonContact>(() => emptyPerson());
  const [brideContact, setBrideContact] = useState<PersonContact>(() => emptyPerson());
  const [religiousVenue, setReligiousVenue] = useState<VenueDetail>(() => emptyVenue());
  const [civilVenue, setCivilVenue] = useState<VenueDetail>(() => emptyVenue());

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setGroomName(data.groomName);
    setBrideName(data.brideName);
    setCivil(isoToDatetimeLocal(data.civilCeremonyAt ?? data.date));
    setReligious(isoToDatetimeLocal(data.religiousCeremonyAt ?? data.date));
    setDescription(data.description ?? "");
    setGroomContact(mergePerson(data.groomContact));
    setBrideContact(mergePerson(data.brideContact));
    setReligiousVenue(mergeVenue(data.religiousVenueDetail, data.venue));
    setCivilVenue(mergeVenue(data.civilVenueDetail));
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groomName.trim() || !brideName.trim()) {
      toast({ variant: "destructive", title: "Informe os nomes do casal" });
      return;
    }
    if (!civil || !religious) {
      toast({ variant: "destructive", title: "Informe as datas da cerimônia civil e religiosa" });
      return;
    }
    const civilD = new Date(civil);
    const relD = new Date(religious);
    if (Number.isNaN(civilD.getTime()) || Number.isNaN(relD.getTime())) {
      toast({ variant: "destructive", title: "Datas inválidas" });
      return;
    }

    const relVenuePayload: VenueDetail = {
      ...religiousVenue,
      name: religiousVenue.name?.trim() ?? "",
    };
    const civilVenuePayload: VenueDetail = {
      ...civilVenue,
      name: civilVenue.name?.trim() ?? "",
    };
    const venueLegacy = relVenuePayload.name || null;

    try {
      await updateMutation.mutateAsync({
        id: wid,
        data: {
          title: title.trim() || undefined,
          groomName: groomName.trim(),
          brideName: brideName.trim(),
          civilCeremonyAt: civilD.toISOString(),
          religiousCeremonyAt: relD.toISOString(),
          venue: venueLegacy,
          description: description.trim() || null,
          groomContact,
          brideContact,
          religiousVenueDetail: relVenuePayload,
          civilVenueDetail: civilVenuePayload,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/weddings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}`] });
      toast({ title: "Dados do casamento salvos" });
    } catch (err) {
      const full =
        err instanceof ApiError
          ? err.getFullDetails()
          : err instanceof Error
            ? err.message
            : "Tente novamente.";
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        duration: 120_000,
        description: (
          <div className="mt-1 space-y-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 bg-background/90 text-foreground hover:bg-background"
              onClick={() => {
                void copyTextToClipboard(full);
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copiar mensagem
            </Button>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs font-mono leading-snug select-text cursor-text">
              {full}
            </pre>
          </div>
        ),
      });
    }
  };

  if (!Number.isFinite(wid) || wid <= 0) {
    return (
      <div className="text-destructive">
        ID inválido.{" "}
        <Link href="/" className="underline">
          Voltar aos casamentos
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-destructive space-y-2">
        <p>Não foi possível carregar este casamento.</p>
        <Link href="/" className="text-primary underline text-sm">
          Voltar à lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href={`/weddings/${wid}/dashboard`}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-serif text-foreground">Dados do casamento</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dados do casal, contatos, endereços (CEP com consulta automática) e locais das cerimônias.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Evento e cerimônias</CardTitle>
            <CardDescription>Título, nomes e datas das cerimônias civil e religiosa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título do evento</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Casamento Ana & Bruno" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do noivo / parceiro 1</label>
                <Input value={groomName} onChange={(e) => setGroomName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nome da noiva / parceiro 2</label>
                <Input value={brideName} onChange={(e) => setBrideName(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" /> Cerimônia civil
                </label>
                <Input type="datetime-local" value={civil} onChange={(e) => setCivil(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Church className="w-3.5 h-3.5" /> Cerimônia religiosa
                </label>
                <Input type="datetime-local" value={religious} onChange={(e) => setReligious(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Notas internas"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Noivo / parceiro 1</CardTitle>
            <CardDescription>Endereço (comece pelo CEP), telefone e e-mail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressCepFields
              idPrefix="groom"
              value={personToAddressSlice(groomContact)}
              onChange={(next) => setGroomContact({ ...groomContact, ...next })}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium mb-1" htmlFor="groom-phone">
                  Telefone
                </label>
                <Input
                  id="groom-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={groomContact.phone ?? ""}
                  onChange={(e) => setGroomContact({ ...groomContact, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <label className="flex items-center gap-2 text-sm pb-2 sm:pb-0 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={groomContact.phoneHasWhatsapp ?? false}
                  onChange={(e) => setGroomContact({ ...groomContact, phoneHasWhatsapp: e.target.checked })}
                />
                Número possui WhatsApp
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="groom-email">
                E-mail
              </label>
              <Input
                id="groom-email"
                type="email"
                autoComplete="email"
                value={groomContact.email ?? ""}
                onChange={(e) => setGroomContact({ ...groomContact, email: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Noiva / parceiro 2</CardTitle>
            <CardDescription>Endereço (comece pelo CEP), telefone e e-mail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressCepFields
              idPrefix="bride"
              value={personToAddressSlice(brideContact)}
              onChange={(next) => setBrideContact({ ...brideContact, ...next })}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium mb-1" htmlFor="bride-phone">
                  Telefone
                </label>
                <Input
                  id="bride-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={brideContact.phone ?? ""}
                  onChange={(e) => setBrideContact({ ...brideContact, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <label className="flex items-center gap-2 text-sm pb-2 sm:pb-0 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={brideContact.phoneHasWhatsapp ?? false}
                  onChange={(e) => setBrideContact({ ...brideContact, phoneHasWhatsapp: e.target.checked })}
                />
                Número possui WhatsApp
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="bride-email">
                E-mail
              </label>
              <Input
                id="bride-email"
                type="email"
                autoComplete="email"
                value={brideContact.email ?? ""}
                onChange={(e) => setBrideContact({ ...brideContact, email: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local da cerimônia civil</CardTitle>
            <CardDescription>Nome do local e endereço completo (CEP com busca automática).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="civil-venue-name">
                Nome do local
              </label>
              <Input
                id="civil-venue-name"
                value={civilVenue.name ?? ""}
                onChange={(e) => setCivilVenue({ ...civilVenue, name: e.target.value })}
                placeholder="Ex.: Cartório Central"
              />
            </div>
            <AddressCepFields
              idPrefix="civil-venue"
              value={venueToAddressSlice(civilVenue)}
              onChange={(next) => setCivilVenue({ ...civilVenue, ...next })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local da cerimônia religiosa</CardTitle>
            <CardDescription>Nome do local, endereço e link do Google Maps, se desejar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="rel-venue-name">
                Nome do local
              </label>
              <Input
                id="rel-venue-name"
                value={religiousVenue.name ?? ""}
                onChange={(e) => setReligiousVenue({ ...religiousVenue, name: e.target.value })}
                placeholder="Ex.: Capela Nossa Senhora…"
              />
            </div>
            <AddressCepFields
              idPrefix="rel-venue"
              value={venueToAddressSlice(religiousVenue)}
              onChange={(next) => setReligiousVenue({ ...religiousVenue, ...next })}
            />
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="rel-maps">
                Link do Google Maps
              </label>
              <Input
                id="rel-maps"
                type="url"
                value={religiousVenue.mapsUrl ?? ""}
                onChange={(e) => setReligiousVenue({ ...religiousVenue, mapsUrl: e.target.value })}
                placeholder="https://maps.google.com/..."
                autoComplete="off"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={updateMutation.isPending} size="lg">
          {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>
    </div>
  );
}
