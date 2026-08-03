import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  FileText,
  Home,
  Receipt,
  HeartPulse,
  TrendingUp,
  Users,
  User2,
  ClipboardList,
  Landmark,
  GitCompareArrows,
  Percent,
  Scale,
  Building2,
  History,
  Library,
} from "lucide-react";
import logoAsset from "@/assets/logo-vp.png.asset.json";
import type { DossierData } from "@/lib/calculs/types";
import { SECTION_GROUPS, pageStatut, LIBELLE_STATUT, type SectionMeta } from "@/lib/dossier/pageStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  identite: FileText,
  pt: Receipt,
  ept: HeartPulse,
  pp: TrendingUp,
  epp: User2,
  deces: Users,
  survie: Users,
  tp: Landmark,
  synthese: ClipboardList,
  comparateur: GitCompareArrows,
  interets: Percent,
  activite: History,
};

interface Props {
  id: string;
  reference: string;
  nbAvertissements?: number;
  dossier?: DossierData | null;
  onNavigate?: () => void;
}

export function AppSidebar({ id, reference, nbAvertissements = 0, dossier = null, onNavigate }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <TooltipProvider delayDuration={400}>
    <aside className="w-72 shrink-0 h-full min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="px-5 py-6 border-b border-sidebar-border/60">
        <div className="flex items-center gap-2">
          <img src={logoAsset.url} alt="Victimes & Préjudices" className="w-7 h-7 shrink-0" />
          <div className="text-[10px] font-semibold text-accent font-display tracking-[0.18em]">
            VICTIMES &amp; PRÉJUDICES
          </div>
        </div>
        <div className="mt-4 space-y-0.5">
          <Link to="/dossiers" onClick={onNavigate} className="flex items-center gap-2.5 text-[13px] text-sidebar-foreground/65 hover:text-sidebar-foreground min-h-9">
            <Home className="w-4 h-4" />
            Retour aux dossiers
          </Link>
          <Link to="/taux-legal" onClick={onNavigate} className="flex items-center gap-2.5 text-[13px] text-sidebar-foreground/65 hover:text-sidebar-foreground min-h-9">
            <Scale className="w-4 h-4" />
            Taux légal
          </Link>
          <Link to="/cabinet" onClick={onNavigate} className="flex items-center gap-2.5 text-[13px] text-sidebar-foreground/65 hover:text-sidebar-foreground min-h-9">
            <Building2 className="w-4 h-4" />
            Cabinet
          </Link>
          <Link to="/referentiels" onClick={onNavigate} className="flex items-center gap-2.5 text-[13px] text-sidebar-foreground/65 hover:text-sidebar-foreground min-h-9">
            <Library className="w-4 h-4" />
            Référentiels
          </Link>
        </div>
      </div>

      <div className="px-5 py-5 border-b border-sidebar-border/60">
        <div className="text-[10px] text-sidebar-foreground/45 uppercase tracking-[0.16em] font-display">Dossier</div>
        <div className="mt-1 font-display text-sm font-medium text-sidebar-foreground truncate" title={reference}>
          {reference || "Sans nom"}
        </div>
      </div>

      <nav aria-label="Navigation du dossier" className="flex-1 py-4 overflow-y-auto">
        {SECTION_GROUPS.map((g) => (
          <div key={g.title} className="mb-5" role="group" aria-label={g.title}>
            <div className="px-5 pb-2 text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40 font-display font-semibold">
              {g.title}
            </div>

            {g.items.map((s: SectionMeta) => {
              const target = s.route === "/dossiers/$id" ? `/dossiers/${id}` : s.route.replace("$id", id);
              const active = pathname === target;
              const Icon = ICONS[s.key] ?? FileText;
              const statut = pageStatut(s.key, dossier);
              return (
                <Link
                  key={s.label}
                  to={s.route}
                  params={{ id }}
                  hash={s.route === "/dossiers/$id/synthese" && nbAvertissements > 0 ? "section-controles-coherence" : undefined}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 px-5 py-2 text-[13px] border-l-2 transition-colors min-h-10",
                      active
                        ? "border-primary text-sidebar-foreground font-medium"
                        : "border-transparent text-sidebar-foreground/65 hover:text-sidebar-foreground hover:border-sidebar-foreground/25",
                    )}
                  >

                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <Tooltip delayDuration={400}>
                      <TooltipTrigger asChild>
                        <span className="flex-1 min-w-0 truncate">{s.label}</span>
                      </TooltipTrigger>
                      <TooltipContent side="right">{s.label}</TooltipContent>
                    </Tooltip>
                    {s.route === "/dossiers/$id/synthese" && nbAvertissements > 0 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground font-display font-semibold shrink-0"
                        aria-label={`${nbAvertissements} avertissement${nbAvertissements > 1 ? "s" : ""}`}
                      >
                        {nbAvertissements}
                      </span>
                    )}
                    <span
                      title={LIBELLE_STATUT[statut]}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 border",
                        statut === "complete" && "bg-success border-success",
                        statut === "en_cours" && "bg-transparent border-accent",
                        statut === "vide" && "bg-transparent border-sidebar-foreground/30",
                      )}
                    >
                      <span className="sr-only">{LIBELLE_STATUT[statut]}</span>
                    </span>

                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>


      <div className="p-4 text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border">
        Version beta 0.7
      </div>
    </aside>
    </TooltipProvider>
  );
}

/** Ordre logique des pages du dossier pour la navigation Précédent / Suivant. */
export const DOSSIER_PAGES_ORDER: { path: string; label: string; key: string }[] = SECTION_GROUPS.flatMap(
  (g) => g.items.map((s) => ({ path: s.route, label: s.label, key: s.key })),
);
