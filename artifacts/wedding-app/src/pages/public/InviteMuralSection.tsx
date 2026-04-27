import { useEffect, useState } from "react";
import { Heart, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { postMuralMessage } from "@/lib/shop-api";
import { useToast } from "@/hooks/use-toast";
import { BotanicoDeco } from "./botanico-deco";
import type { ResolvedPublicInvitePageConfig } from "./public-invite-page-config";

export type InviteMuralSectionProps =
  | {
      layout: "classic";
      primaryColor: string;
      guestToken: string;
      guestName: string;
    }
  | {
      layout: "botanico";
      primaryColor: string;
      guestToken: string;
      guestName: string;
      cfg: ResolvedPublicInvitePageConfig;
    };

export function InviteMuralSection(props: InviteMuralSectionProps) {
  const { primaryColor, guestToken, guestName } = props;
  const layout = props.layout;
  const { toast } = useToast();
  const [muralAuthor, setMuralAuthor] = useState(guestName);
  const [muralText, setMuralText] = useState("");
  const [muralSending, setMuralSending] = useState(false);
  const [muralSent, setMuralSent] = useState(false);

  useEffect(() => {
    setMuralAuthor(guestName);
  }, [guestName]);

  async function handleSendMural() {
    if (!muralAuthor.trim()) {
      toast({ variant: "destructive", title: "Informe seu nome" });
      return;
    }
    if (!muralText.trim()) {
      toast({ variant: "destructive", title: "Escreva uma mensagem" });
      return;
    }
    if (muralText.length > 500) {
      toast({ variant: "destructive", title: "Mensagem muito longa (máx. 500 caracteres)" });
      return;
    }
    setMuralSending(true);
    try {
      await postMuralMessage({ guestToken, authorName: muralAuthor.trim(), message: muralText.trim() });
      setMuralText("");
      setMuralSent(true);
      toast({ title: "Mensagem enviada com carinho!" });
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Erro ao enviar mensagem" });
    } finally {
      setMuralSending(false);
    }
  }

  const inputClassClassic =
    "w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 bg-white text-[#333] placeholder:text-gray-400 focus:ring-[color:var(--invite-primary)] focus:border-[color:var(--invite-primary)]";
  const inputClassBotanico =
    "w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7FB3D3]/40 bg-white text-[#2E3A42] placeholder:text-gray-400";
  const inputClass = layout === "botanico" ? inputClassBotanico : inputClassClassic;

  const formInner = (
    <>
      {muralSent ? (
        <div
          className={
            layout === "botanico"
              ? "bg-white rounded-2xl border shadow-sm p-8"
              : "bg-white rounded-xl border border-gray-100 shadow-sm p-8"
          }
          style={layout === "botanico" ? { borderColor: "#D9EAF3" } : undefined}
        >
          <Heart className="w-10 h-10 mx-auto mb-3" style={{ color: primaryColor }} />
          <p
            className="font-semibold text-lg"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
          >
            Mensagem enviada!
          </p>
          <button type="button" className="mt-4 text-sm underline text-gray-500" onClick={() => setMuralSent(false)}>
            Enviar outra
          </button>
        </div>
      ) : (
        <div
          className={
            layout === "botanico"
              ? "bg-white rounded-2xl border shadow-sm p-6 md:p-8 space-y-4 text-left"
              : "bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4 text-left"
          }
          style={layout === "botanico" ? { borderColor: "#D9EAF3" } : undefined}
        >
          <div>
            <label className="text-sm font-semibold">Seu nome</label>
            <Input
              className={inputClass}
              value={muralAuthor}
              onChange={(e) => setMuralAuthor(e.target.value)}
              style={{ ["--invite-primary" as string]: primaryColor }}
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Mensagem</label>
            <textarea
              className={`${inputClass} min-h-[100px] resize-none`}
              value={muralText}
              onChange={(e) => setMuralText(e.target.value)}
              maxLength={500}
              placeholder="Compartilhe um desejo, uma lembrança…"
              style={{ ["--invite-primary" as string]: primaryColor }}
            />
            <p className="text-xs text-gray-400 text-right">{muralText.length}/500</p>
          </div>
          <Button
            className="w-full text-white rounded-full gap-2"
            style={{ backgroundColor: primaryColor }}
            disabled={muralSending}
            onClick={() => void handleSendMural()}
          >
            <Send className="w-4 h-4" />
            {muralSending ? "Enviando…" : "Enviar mensagem"}
          </Button>
        </div>
      )}
    </>
  );

  if (props.layout === "botanico") {
    const { cfg } = props;
    return (
      <section id="mural" className="py-24 px-6 relative overflow-hidden border-t border-[#D9EAF3]/80" style={{ backgroundColor: "#F4F9FD" }}>
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-8">
              <BotanicoDeco
                cfg={cfg}
                rasterKey="botanicoDividerUrl"
                symbolId="floralDivider"
                vbW={340}
                vbH={60}
                className="w-full max-w-[340px] h-[55px] object-contain"
              />
            </div>
            <h2
              className="font-serif text-4xl md:text-5xl mb-3"
              style={{ color: primaryColor, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}
            >
              Mural de Mensagens
            </h2>
            <p className="text-lg text-gray-600">Deixe uma mensagem especial para os noivos.</p>
          </div>
          {formInner}
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-6 border-t border-gray-200 bg-white" id="mural">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl mb-3" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
          Mural de Mensagens
        </h2>
        <p className="text-gray-500 mb-8">Deixe uma mensagem especial para os noivos.</p>
        {formInner}
      </div>
    </section>
  );
}
