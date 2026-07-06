import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { FileText, Home, Receipt, HeartPulse, TrendingUp, Users, User2, ClipboardList } from "lucide-react";

interface Section {
  label: string;
  to: "/dossiers/$id" | "/dossiers/$id/patrimoniaux-temporaires" | "/dossiers/$id/extrapatrimoniaux-temporaires" | "/dossiers/$id/patrimoniaux-permanents" | "/dossiers/$id/extrapatrimoniaux-permanents" | "/dossiers/$id/deces" | "/dossiers/$id/survie-proches" | "/dossiers/$id/synthese";
  icon: React.ComponentType<{ className?: string }>;
  phase?: string;
}

const SECTIONS: Section[] = [
  { label: "Dossier", to: "/dossiers/$id", icon: FileText },
  { label: "Préj. patrimoniaux temporaires", to: "/dossiers/$id/patrimoniaux-temporaires", icon: Receipt },
  { label: "Préj. extrapatrimoniaux temporaires", to: "/dossiers/$id/extrapatrimoniaux-temporaires", icon: HeartPulse },
  { label: "Préj. patrimoniaux permanents", to: "/dossiers/$id/patrimoniaux-permanents", icon: TrendingUp },
  { label: "Préj. extrapatrimoniaux permanents", to: "/dossiers/$id/extrapatrimoniaux-permanents", icon: User2 },
  { label: "Victimes indirectes — décès", to: "/dossiers/$id/deces", icon: Users, phase: "Phase 4" },
  { label: "Victimes indirectes — survie", to: "/dossiers/$id/survie-proches", icon: Users, phase: "Phase 4" },
  { label: "Synthèse", to: "/dossiers/$id/synthese", icon: ClipboardList, phase: "Phase 5" },
];

export function AppSidebar({ id, reference }: { id: string; reference: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="w-72 shrink-0 min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-5 border-b border-sidebar-border">
        <div className="text-[10px] font-semibold text-accent font-display tracking-widest">
          VICTIMES &amp; PRÉJUDICES
        </div>
        <Link to="/dossiers" className="mt-2 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground">
          <Home className="w-4 h-4" />
          Retour aux dossiers
        </Link>
      </div>

      <div className="p-5 border-b border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/60 uppercase tracking-wide font-display">Dossier</div>
        <div className="mt-1 font-display font-semibold text-sidebar-foreground truncate" title={reference}>
          {reference || "Sans nom"}
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {SECTIONS.map((s) => {
          const target = s.to === "/dossiers/$id" ? `/dossiers/${id}` : s.to.replace("$id", id);
          const active = pathname === target;
          const disabled = !!s.phase; // Phases futures non encore actives
          const Icon = s.icon;
          const content = (
            <div
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition",
                active
                  ? "border-primary bg-sidebar-accent text-sidebar-foreground"
                  : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                disabled && "opacity-45 cursor-not-allowed",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{s.label}</span>
              {s.phase && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sidebar-border text-sidebar-foreground/70 font-display">
                  {s.phase}
                </span>
              )}
            </div>
          );
          return disabled ? (
            <div key={s.label}>{content}</div>
          ) : (
            <Link key={s.label} to={s.to} params={{ id }}>
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border">
        Version bta 0.7 — Aide au calcul de C. Quézel-Ambrunaz. Barèmes 2025, taux 0,5&nbsp;%.
      </div>
    </aside>
  );
}
