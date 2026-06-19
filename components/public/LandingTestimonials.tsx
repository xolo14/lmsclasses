import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

const testimonials = [
  {
    initials: "PK",
    name: "Priya K.",
    placement: "Tech Mahindra",
    quote:
      "The live sessions and mentor support made complex topics click. I landed my first role within two months.",
  },
  {
    initials: "AR",
    name: "Arjun R.",
    placement: "Infosys",
    quote:
      "Structured curriculum, real projects, and interview prep — everything I needed was in one place.",
  },
  {
    initials: "NM",
    name: "Neha M.",
    placement: "Wipro",
    quote:
      "Recordings let me revise on my schedule while live classes kept me accountable.",
  },
];

export function LandingTestimonials() {
  return (
    <LandingSection>
      <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pb-8">
        <p className={landingLayout.label}>Student stories</p>
        <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-[-0.03em] text-neutral-950 md:text-4xl">
          Results that speak for themselves.
        </h2>
      </LandingCell>

      {testimonials.map((t) => (
        <LandingCell
          key={t.name}
          span="col-span-4 md:col-span-4 lg:col-span-4"
          className="!border-r !border-neutral-950/10"
        >
          <blockquote className="text-sm leading-relaxed text-neutral-700">
            &ldquo;{t.quote}&rdquo;
          </blockquote>
          <footer className="mt-8 border-t border-neutral-950/10 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-950">
              {t.name}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Placed at {t.placement}</p>
          </footer>
        </LandingCell>
      ))}
    </LandingSection>
  );
}
