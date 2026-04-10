import { useRef, useEffect } from "react";
import { useCreateGuestGroup, getListGuestGroupsQueryKey } from "@workspace/api-client-react";
import type { GuestGroup } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface GroupComboBoxProps {
  weddingId: number;
  groups: GuestGroup[] | undefined;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupComboBox({
  weddingId,
  groups,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  open,
  onOpenChange,
}: GroupComboBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createGuestGroupMutation = useCreateGuestGroup();

  const trimmed = filter.trim();
  const hasExact = trimmed.length > 0 && groups?.some((g) => g.name.toLowerCase() === trimmed.toLowerCase());
  const filtered = groups?.filter((g) =>
    trimmed ? g.name.toLowerCase().includes(trimmed.toLowerCase()) : true,
  ) ?? [];
  const selectedLabel = selectedId != null ? groups?.find((g) => g.id === selectedId)?.name : null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange]);

  const handleCreateGroup = async () => {
    if (!trimmed || hasExact) return;
    try {
      const created = await createGuestGroupMutation.mutateAsync({
        weddingId,
        data: { name: trimmed },
      });
      queryClient.invalidateQueries({ queryKey: getListGuestGroupsQueryKey(weddingId) });
      onSelect(created.id);
      onOpenChange(false);
      onFilterChange("");
      toast({ title: "Grupo criado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao criar grupo" });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="text-sm font-medium">Grupo</label>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="mt-1.5 w-full justify-between font-normal"
        onClick={() => onOpenChange(!open)}
      >
        {selectedLabel ?? "Selecione ou crie um grupo…"}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b border-border px-2 py-2">
            <Input
              placeholder="Buscar ou digite um novo…"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
              autoFocus
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto p-1">
            {filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(g.id);
                  onOpenChange(false);
                  onFilterChange("");
                }}
              >
                <Check className={cn("h-4 w-4 shrink-0", selectedId === g.id ? "opacity-100" : "opacity-0")} />
                {g.name}
              </button>
            ))}
            {trimmed && !hasExact && (
              <button
                type="button"
                className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => void handleCreateGroup()}
                disabled={createGuestGroupMutation.isPending}
              >
                Criar grupo &quot;{trimmed}&quot;
              </button>
            )}
            {groups == null && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Carregando grupos…</p>
            )}
            {groups != null && filtered.length === 0 && !trimmed && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum grupo cadastrado.</p>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Colegas, Trabalho e Família vêm por padrão; você pode adicionar outros.
      </p>
    </div>
  );
}
