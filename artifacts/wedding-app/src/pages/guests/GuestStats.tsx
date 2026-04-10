import { Card, CardContent } from "@/components/ui/card";
import type { Guest } from "@workspace/api-client-react";

interface GuestStatsProps {
  guests: Guest[] | undefined;
  groomName: string | undefined;
  brideName: string | undefined;
}

export function GuestStats({ guests, groomName, brideName }: GuestStatsProps) {
  if (!guests?.length) return null;

  const total = guests.length;
  const confirmed = guests.filter((g) => g.rsvpStatus === "confirmed").length;
  const pending = guests.filter((g) => g.rsvpStatus === "pending").length;
  const countByGroom = guests.filter((g) => g.invitedBy === "groom").length;
  const countByBride = guests.filter((g) => g.invitedBy === "bride").length;
  const countInvitedUnset = guests.filter((g) => g.invitedBy == null).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{confirmed}</p>
            <p className="text-xs text-muted-foreground">Confirmados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      {(groomName || brideName) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{countByGroom}</p>
              <p className="text-xs text-muted-foreground line-clamp-2" title={groomName}>
                Por {groomName}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{countByBride}</p>
              <p className="text-xs text-muted-foreground line-clamp-2" title={brideName}>
                Por {brideName}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{countInvitedUnset}</p>
              <p className="text-xs text-muted-foreground">Sem &quot;convidado por&quot;</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
