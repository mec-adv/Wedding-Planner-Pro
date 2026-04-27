import { useEffect, useMemo, useState } from "react";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { resolveMediaUrl } from "@/lib/api-url";

type InvitePhotoCarouselSectionProps = {
  imageUrls?: string[];
  primaryColor: string;
  layout: "classic" | "botanico";
};

export function InvitePhotoCarouselSection({
  imageUrls,
  primaryColor,
  layout,
}: InvitePhotoCarouselSectionProps) {
  const validUrls = useMemo(
    () =>
      (imageUrls ?? [])
        .filter((u) => typeof u === "string" && u.trim() !== "")
        .slice(0, 10),
    [imageUrls],
  );
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => api.off("select", onSelect);
  }, [api]);

  if (validUrls.length === 0) return null;

  const showNav = validUrls.length > 1;
  const sectionClass =
    layout === "botanico"
      ? "py-24 relative overflow-hidden"
      : "py-16 text-center border-t border-gray-200";
  const sectionStyle = layout === "botanico" ? { backgroundColor: "#F4F9FD" } : undefined;
  const titleClass =
    layout === "botanico"
      ? "font-serif text-5xl mb-10"
      : "text-4xl mb-8";
  const titleStyle =
    layout === "botanico"
      ? { color: primaryColor, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" as const }
      : { color: primaryColor, fontFamily: "'Cormorant Garamond', serif" as const };

  const titleWrapperClass =
    layout === "botanico"
      ? "max-w-5xl mx-auto text-center relative z-10 px-6"
      : "max-w-5xl mx-auto text-center px-6";

  return (
    <section id="galeria" className={sectionClass} style={sectionStyle}>
      <div className={titleWrapperClass}>
        <h2 className={titleClass} style={titleStyle}>
          Galeria do Casal
        </h2>
      </div>
      <div className="relative w-full overflow-hidden bg-neutral-900">
        <Carousel setApi={setApi} opts={{ loop: showNav, align: "start" }} className="w-full">
          <CarouselContent className="-ml-0">
            {validUrls.map((url, i) => (
              <CarouselItem key={i} className="pl-0 basis-full">
                <div className="w-full h-[min(58vh,640px)] min-h-[280px] sm:min-h-[360px] lg:min-h-[460px] bg-neutral-800">
                  <img
                    src={resolveMediaUrl(url)}
                    alt={`Foto ${i + 1} da galeria do casal`}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {showNav ? (
            <>
              <CarouselPrevious
                className="left-2 sm:left-4 border-white/30 bg-black/35 text-white hover:bg-black/50 shadow-none backdrop-blur-[2px]"
                aria-label="Foto anterior"
              />
              <CarouselNext
                className="right-2 sm:right-4 border-white/30 bg-black/35 text-white hover:bg-black/50 shadow-none backdrop-blur-[2px]"
                aria-label="Próxima foto"
              />
            </>
          ) : null}
        </Carousel>

        {showNav ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-4 pt-16 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
            aria-hidden
          >
            <div className="pointer-events-auto flex justify-center gap-1.5">
              {validUrls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ir para foto ${i + 1}`}
                  aria-current={current === i ? "true" : undefined}
                  className="h-2 rounded-full transition-all shadow-sm ring-1 ring-white/30"
                  style={{
                    width: current === i ? 24 : 8,
                    backgroundColor: current === i ? primaryColor : "rgba(255,255,255,0.45)",
                  }}
                  onClick={() => api?.scrollTo(i)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
