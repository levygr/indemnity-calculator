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
} from "lucide-react";
import logoAsset from "@/assets/logo-vp.png.asset.json";
import type { DossierData } from "@/lib/calculs/types";

interface Section {
  label: string;
  to:
    | "/dossiers/$id"
    | "/dossiers/$id/patrimoniaux-temporaires"
    | "/dossiers/$id/extrapatrimoniaux-temporaires"
    | "/dossiers/$id/patrimoniaux-permanents"
    | "/dossiers/$id/extrapatrimoniaux-permanents"
    | "/dossiers/$id/deces"
    | "/dossiers/$id/survie-proches"
    | "/dossiers/$id/tiers-payeurs"
    | "/dossiers/$id/synthese"
    | "/dossiers/$id/comparateur"
    | "/dossiers/$id/interets"
    | "/dossiers/$id/activite";
  icon: React.ComponentType<{ className?: string }>;
  key: string;
}

interface Group {
  title: string;
  items: Section[];
}

const GROUPS: Group[] = [
  {
    title: "Identité",
    items: [{ label: "Dossier", to: "/dossiers/$id", icon: FileText, key: "identite" }],
  },
  {
    title: "Postes temporaires",
    items: [
      { label: "Préj. patrimoniaux temporaires", to: "/dossiers/$id/patrimoniaux-temporaires", icon: Receipt, key: "pt" },
      { label: "Préj. extrapatrimoniaux temporaires", to: "/dossiers/$id/extrapatrimoniaux-temporaires", icon: HeartPulse, key: "ept" },
    ],
  },
  {
    title: "Postes permanents",
    items: [
      { label: "Préj. patrimoniaux permanents", to: "/dossiers/$id/patrimoniaux-permanents", icon: TrendingUp, key: "pp" },
      { label: "Préj. extrapatrimoniaux permanents", to: "/dossiers/$id/extrapatrimoniaux-permanents", icon: User2, key: "epp" },
    ],
  },
  {
    title: "Décès & survie",
    items: [
      { label: "Victimes indirectes - décès", to: "/dossiers/$id/deces", icon: Users, key: "deces" },
      { label: "Victimes indirectes - survie", to: "/dossiers/$id/survie-proches", icon: Users, key: "survie" },
    ],
  },
  {
    title: "Recours & synthèse",
    items: [
      { label: "Tiers payeurs", to: "/dossiers/$id/tiers-payeurs", icon: Landmark, key: "tp" },
      { label: "Synthèse", to: "/dossiers/$id/synthese", icon: ClipboardList, key: "synthese" },
      { label: "Comparateur", to: "/dossiers/$id/comparateur", icon: GitCompareArrows, key: "comparateur" },
      { label: "Intérêts", to: "/dossiers/$id/interets", icon: Percent, key: "interets" },
      { label: "Activité", to: "/dossiers/$id/activite", icon: History, key: "activite" },
    ],
  },
];

/** Retourne true si la page comporte au moins une donnée saisie non triviale. */
function pageHasData(key: string, d: DossierData | null): boolean {
  if (!d) return false;
  const pt = d.postesTemp;
  const pp = d.postesPerm as unknown as Record<string, unknown> | undefined;
  switch (key) {
    case "identite":
      return !!(d.reference && d.reference.trim().length > 0) || !!d.dateNaissance || !!d.dateAccident;
    case "pt":
      return (
        (pt?.dsaPonctuelles?.length ?? 0) > 0 ||
        (pt?.dsaRecurrentes?.length ?? 0) > 0 ||
        (pt?.fraisDivers?.length ?? 0) > 0 ||
        (pt?.atpTemp?.length ?? 0) > 0 ||
        !!pt?.pgpa?.methode
      );
    case "ept":
      return !!(pt?.dft?.tauxJournalier || pt?.se?.montant || pt?.pet?.montant);
    case "pp":
      return !!pp && Object.keys(pp).length > 0;
    case "epp":
      return !!pp && Object.keys(pp).length > 0;
    case "deces":
      return Array.isArray(d.victimesIndirectesDeces) && d.victimesIndirectesDeces.length > 0;
    case "survie":
      return Array.isArray(d.victimesIndirectesSurvie) && d.victimesIndirectesSurvie.length > 0;
    case "tp":
      return (d.organismesTP?.length ?? 0) > 0 || (d.creancesTP?.length ?? 0) > 0;
    case "interets":
      return (d.lignesInterets?.length ?? 0) > 0;
    default:
      return false;
  }
}

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
    <aside className="w-72 shrink-0 h-full min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img src={logoAsset.url} alt="Victimes & Préjudices" className="w-8 h-8 shrink-0" />
          <div className="text-[10px] font-semibold text-accent font-display tracking-widest">
            VICTIMES &amp; PRÉJUDICES
          </div>
        </div>
        <Link to="/dossiers" onClick={onNavigate} className="mt-3 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground min-h-11">
          <Home className="w-4 h-4" />
          Retour aux dossiers
        </Link>
        <Link to="/taux-legal" onClick={onNavigate} className="mt-1 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground min-h-11">
          <Scale className="w-4 h-4" />
          Taux légal
        </Link>
        <Link to="/cabinet" onClick={onNavigate} className="mt-1 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground min-h-11">
          <Building2 className="w-4 h-4" />
          Cabinet
        </Link>
      </div>

      <div className="p-5 border-b border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/60 uppercase tracking-wide font-display">Dossier</div>
        <div className="mt-1 font-display font-semibold text-sidebar-foreground truncate" title={reference}>
          {reference || "Sans nom"}
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-2">
            <div className="px-5 py-1.5 text-[10px] uppercase tracking-widest text-sidebar-foreground/45 font-display font-semibold">
              {g.title}
            </div>
            {g.items.map((s) => {
              const target = s.to === "/dossiers/$id" ? `/dossiers/${id}` : s.to.replace("$id", id);
              const active = pathname === target;
              const Icon = s.icon;
              const hasData = pageHasData(s.key, dossier);
              return (
                <Link key={s.label} to={s.to} params={{ id }} onClick={onNavigate}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition min-h-11",
                      active
                        ? "border-primary bg-sidebar-accent text-sidebar-foreground"
                        : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{s.label}</span>
                    {s.to === "/dossiers/$id/synthese" && nbAvertissements > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground font-display font-semibold shrink-0">
                        {nbAvertissements}
                      </span>
                    )}
                    <span
                      aria-hidden
                      title={hasData ? "Contient des données" : "Vide"}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 border",
                        hasData
                          ? "bg-accent border-accent"
                          : "bg-transparent border-sidebar-foreground/35",
                      )}
                    />
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
  );
}

/** Ordre logique des pages du dossier pour la navigation Précédent / Suivant. */
export const DOSSIER_PAGES_ORDER: { path: string; label: string; key: string }[] = GROUPS.flatMap(
  (g) => g.items.map((s) => ({ path: s.to, label: s.label, key: s.key })),
);
