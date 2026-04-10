import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/phone-input";
import type { PublicInvitePageConfig } from "./public-invite-page-config";
import { RSVP_LABELS } from "./public-invite-types";

type CompanionRow = { name: string; age: string; phoneDigits: string };

interface InviteRsvpSectionProps {
  cfg: PublicInvitePageConfig;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  inputFieldClass: string;
  guestName: string | undefined;
  lgpdNotice: string | undefined;
  rsvpStatus: string;
  onRsvpStatusChange: (status: string) => void;
  dietary: string;
  onDietaryChange: (value: string) => void;
  companionRows: CompanionRow[];
  onCompanionRowsChange: (rows: CompanionRow[]) => void;
  lgpdOk: boolean;
  onLgpdOkChange: (ok: boolean) => void;
  rsvpSaved: boolean;
  isPending: boolean;
  onSave: () => void;
}

export function InviteRsvpSection({
  cfg,
  primaryColor,
  backgroundColor,
  textColor,
  inputFieldClass,
  guestName,
  lgpdNotice,
  rsvpStatus,
  onRsvpStatusChange,
  dietary,
  onDietaryChange,
  companionRows,
  onCompanionRowsChange,
  lgpdOk,
  onLgpdOkChange,
  rsvpSaved,
  isPending,
  onSave,
}: InviteRsvpSectionProps) {
  const updateRow = (index: number, patch: Partial<CompanionRow>) => {
    const next = [...companionRows];
    next[index] = { ...next[index], ...patch };
    onCompanionRowsChange(next);
  };

  const removeRow = (index: number) => {
    onCompanionRowsChange(companionRows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onCompanionRowsChange([...companionRows, { name: "", age: "", phoneDigits: "" }]);
  };

  return (
    <section id="rsvp" className="py-20 px-6 bg-white border-t border-gray-200">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-4xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
            {cfg.rsvpSectionTitle}
          </h2>
          <p>{cfg.rsvpSectionSubtitle}</p>
        </div>

        {rsvpSaved && (
          <div
            id="rsvp-success"
            className="text-center p-8 rounded-lg border border-green-200 mb-10"
            style={{ backgroundColor: "#f0fdf4" }}
          >
            <h3 className="text-3xl mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
              {cfg.rsvpSuccessTitle}
            </h3>
            <p className="text-lg">{cfg.rsvpSuccessMessage}</p>
          </div>
        )}

        <div
          className="space-y-6 p-8 rounded-lg shadow-sm border border-gray-100"
          style={{ backgroundColor }}
        >
          <div>
            <h3
              className="text-2xl mb-4 border-b border-gray-200 pb-2"
              style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
            >
              {cfg.seusDadosTitle}
            </h3>
            <p className="text-sm mb-4">
              <span className="font-semibold">{cfg.convidadoLabel}</span> {guestName}
            </p>

            <p className="text-sm font-semibold mb-2">{cfg.suaPresencaLabel}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {(["confirmed", "declined", "maybe", "pending"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onRsvpStatusChange(s)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm uppercase tracking-wide border transition",
                    rsvpStatus === s
                      ? "text-white border-transparent"
                      : "bg-white border-gray-300 hover:border-[color:var(--invite-primary)]",
                  )}
                  style={rsvpStatus === s ? { backgroundColor: primaryColor } : { color: textColor }}
                >
                  {RSVP_LABELS[s]}
                </button>
              ))}
            </div>

            {rsvpStatus !== "declined" && (
              <>
                <div id="companions-container" className="space-y-4">
                  {companionRows.map((row, i) => (
                    <div
                      key={i}
                      className="p-4 border-l-4 bg-white rounded shadow-sm relative"
                      style={{ borderLeftColor: primaryColor }}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h4
                          className="font-bold text-lg"
                          style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
                        >
                          {cfg.acompanhanteLabel} {i + 1}
                        </h4>
                        <button
                          type="button"
                          className="text-red-400 text-sm hover:text-red-600 transition"
                          onClick={() => removeRow(i)}
                        >
                          {cfg.removerLabel}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1 font-semibold">Nome completo</label>
                          <input
                            type="text"
                            className={inputFieldClass}
                            value={row.name}
                            onChange={(e) => updateRow(i, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1 font-semibold">Idade</label>
                          <input
                            type="number"
                            min={0}
                            max={120}
                            className={inputFieldClass}
                            value={row.age}
                            onChange={(e) => updateRow(i, { age: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm mb-1 font-semibold">Celular (opcional)</label>
                          <PhoneInput
                            className={inputFieldClass}
                            value={row.phoneDigits}
                            onDigitsChange={(digits) => updateRow(i, { phoneDigits: digits })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="px-6 py-2 rounded-full hover:text-white transition text-sm uppercase tracking-wide border"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = primaryColor;
                      e.currentTarget.style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = primaryColor;
                    }}
                  >
                    + Adicionar acompanhante
                  </button>
                </div>
              </>
            )}

            <div className="mt-6">
              <label className="block text-sm mb-1 font-semibold">{cfg.restricoesLabel}</label>
              <input
                type="text"
                className={inputFieldClass}
                value={dietary}
                onChange={(e) => onDietaryChange(e.target.value)}
                placeholder={cfg.restricoesPlaceholder}
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer mt-6">
              <input
                type="checkbox"
                checked={lgpdOk}
                onChange={(e) => onLgpdOkChange(e.target.checked)}
                className="mt-1"
              />
              <span>{lgpdNotice}</span>
            </label>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <button
              type="button"
              disabled={isPending}
              onClick={onSave}
              className="w-full text-white font-bold px-8 py-4 rounded hover:opacity-90 transition uppercase tracking-widest text-lg shadow-md disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {isPending ? "Enviando…" : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
