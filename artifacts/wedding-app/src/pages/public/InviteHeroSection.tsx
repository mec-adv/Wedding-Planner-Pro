import type { CSSProperties } from "react";
import type { PublicInvitePageConfig } from "./public-invite-page-config";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  passed: boolean;
}

interface InviteHeroSectionProps {
  cfg: PublicInvitePageConfig;
  bride: string;
  groom: string;
  heroDateLine: string;
  targetMs: number | null;
  countdown: Countdown;
  primaryColor: string;
  backgroundColor: string;
}

export function InviteHeroSection({
  cfg,
  bride,
  groom,
  heroDateLine,
  targetMs,
  countdown,
  primaryColor,
  backgroundColor,
}: InviteHeroSectionProps) {
  return (
    <section className="min-h-screen flex flex-col justify-center items-center text-center p-6 relative">
      <div
        className="max-w-2xl p-10 rounded-xl shadow-sm border border-gray-100"
        style={{ backgroundColor }}
      >
        <h2
          className="tracking-widest uppercase text-sm mb-4 font-bold"
          style={{ color: primaryColor }}
        >
          {cfg.heroTagline}
        </h2>
        <h1
          className="text-6xl md:text-8xl mb-6 leading-tight"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
        >
          {bride} <span className="italic font-light">&</span> {groom}
        </h1>
        {heroDateLine && (
          <p
            className="text-xl md:text-2xl mb-8"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {heroDateLine}
          </p>
        )}

        <div className="flex gap-4 justify-center text-center mb-10 min-h-[4rem] items-center">
          {targetMs == null ? null : countdown.passed ? (
            <p
              className="text-lg"
              style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
            >
              {cfg.mensagemAposCerimonia}
            </p>
          ) : cfg.showCountdown ? (
            <>
              {[
                { value: countdown.days, label: cfg.countdownDayLabel },
                { value: countdown.hours, label: cfg.countdownHourLabel },
                { value: countdown.minutes, label: cfg.countdownMinLabel },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col">
                  <span
                    className="text-3xl"
                    style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
                  >
                    {value}
                  </span>
                  <span className="text-xs uppercase">{label}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>

        <a
          href="#rsvp"
          className="inline-block text-white px-8 py-3 rounded-full uppercase tracking-wider text-sm transition shadow-md hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          {cfg.ctaRsvp}
        </a>
      </div>
    </section>
  );
}
