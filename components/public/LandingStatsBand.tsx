import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

const stats = [
  { value: "30+", label: "Courses" },
  { value: "500+", label: "Active students" },
  { value: "Live", label: "Project sessions" },
  { value: "100%", label: "Placement assistance" },
];

export function LandingStatsBand() {
  return (
    <LandingSection bleed>
      {stats.map((stat) => (
        <LandingCell
          key={stat.label}
          span="col-span-2 md:col-span-2 lg:col-span-3"
          className="!border-r !border-neutral-950/10 lg:[&:nth-child(4n)]:border-r-0"
        >
          <p className="text-4xl font-bold tracking-[-0.04em] text-neutral-950 md:text-5xl">
            {stat.value}
          </p>
          <p className={`mt-3 ${landingLayout.label}`}>{stat.label}</p>
        </LandingCell>
      ))}
    </LandingSection>
  );
}
