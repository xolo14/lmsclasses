import { Star } from "lucide-react";

const testimonials = [
  {
    initials: "PK",
    name: "Priya K.",
    placement: "Placed at Tech Mahindra",
    quote:
      "The live sessions and mentor support made complex topics click. I landed my first role within two months of completing the program.",
  },
  {
    initials: "AR",
    name: "Arjun R.",
    placement: "Placed at Infosys",
    quote:
      "Structured curriculum, real projects, and interview prep — everything I needed was in one place. Worth every rupee.",
  },
  {
    initials: "NM",
    name: "Neha M.",
    placement: "Placed at Wipro",
    quote:
      "Recordings let me revise on my schedule while live classes kept me accountable. The job portal connections were genuinely helpful.",
  },
];

function StarRow() {
  return (
    <div className="flex gap-0.5 text-gold">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />
      ))}
    </div>
  );
}

export function LandingTestimonials() {
  return (
    <section className="bg-bg-base py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
            Student stories
          </p>
          <h2 className="mt-3 font-display text-3xl text-text-primary md:text-4xl">
            Results that speak for themselves
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <article
              key={t.name}
              className="flex flex-col rounded-xl border border-bg-border bg-bg-card p-6 md:p-8"
            >
              <StarRow />
              <blockquote className="mt-5 flex-1 text-sm leading-relaxed text-text-secondary">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <footer className="mt-6 flex items-center gap-3 border-t border-bg-border pt-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-border text-xs font-semibold text-text-secondary">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.placement}</p>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
