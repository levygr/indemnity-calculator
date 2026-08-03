/**
 * Tableau de bord synthétique du dossier : progression par section + rappel
 * de la part victime, avertissements et derniers chiffrages figés.
 */
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTION_GROUPS, pageHasData } from "@/lib/dossier/pageStatus";
import type { DossierData } from "@/lib/calculs/types";
import { calculerSynthese, collecterAvertissements, formatEuros } from "@/lib/calculs";
import { formatDateFR } from "@/lib/calculs/format";
import { listSnapshots } from "@/lib/dossiers.functions";
import { AlertTriangle, CheckCircle2, Circle, Camera } from "lucide-react";

export function DossierDashboard({
  dossierId,
  dossier,
}: {
  dossierId: string;
  dossier: DossierData;
}) {
  const synth = useMemo(() => calculerSynthese(dossier), [dossier]);
  const nbAvertissements = useMemo(
    () => collecterAvertissements(dossier).length,
    [dossier],
  );

  const fetchSnap = useServerFn(listSnapshots);
  const { data: snaps } = useQuery({
    queryKey: ["snapshots", dossierId],
    queryFn: () => fetchSnap({ data: { dossierId } }),
  });
  const derniers = (snaps ?? []).slice(0, 3);

  return (
    <section className="space-y-8" aria-label="Tableau de bord du dossier">
      <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-[10px] font-display uppercase tracking-[0.16em] text-muted-foreground">
            Part victime courante
          </div>
          <div className="mt-1.5 text-2xl font-display font-semibold tabular-nums">
            {formatEuros(synth.totalVictime)}
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            Solde après provisions :{" "}
            <span className="tabular-nums">{formatEuros(synth.soldeVictime)}</span>
          </p>
        </div>

        <div>
          <div className="text-[10px] font-display uppercase tracking-[0.16em] text-muted-foreground">
            Contrôles de cohérence
          </div>
          {nbAvertissements > 0 ? (
            <Link
              to="/dossiers/$id/synthese"
              params={{ id: dossierId }}
              hash="section-controles-coherence"
              className="mt-1.5 flex items-baseline gap-2 text-destructive hover:underline"
            >
              <span className="text-2xl font-display font-semibold tabular-nums">
                {nbAvertissements}
              </span>
              <span className="text-[13px] text-muted-foreground">à examiner</span>
            </Link>
          ) : (
            <div className="mt-1.5 flex items-center gap-2 text-[13px]">
              <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
              Aucune incohérence
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] font-display uppercase tracking-[0.16em] text-muted-foreground">
            Derniers chiffrages figés
          </div>
          {derniers.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground">Aucun chiffrage figé.</p>
          ) : (
            <ul className="mt-1.5 space-y-1 text-[13px]">
              {derniers.map((s) => {
                const total = (s.synthese as unknown as { totalVictime?: number } | null)?.totalVictime;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {s.nom}{" "}
                      <span className="text-muted-foreground/70">
                        ({formatDateFR(s.created_at.slice(0, 10))})
                      </span>
                    </span>
                    <span className="tabular-nums shrink-0">
                      {typeof total === "number" ? formatEuros(total) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="text-[10px] font-display uppercase tracking-[0.16em] text-muted-foreground">
          Progression des sections
        </h2>
        <ul className="mt-2 divide-y divide-border">
          {SECTION_GROUPS.flatMap((g) => g.items).map((s) => {
            const has = pageHasData(s.key, dossier);
            return (
              <li key={s.key}>
                <Link
                  to={s.route}
                  params={{ id: dossierId }}
                  className="flex items-center justify-between gap-3 py-2.5 text-[14px] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors"
                >
                  <span className="truncate">{s.label}</span>
                  <span
                    className={
                      has
                        ? "text-[11px] font-display text-success shrink-0"
                        : "text-[11px] font-display text-muted-foreground/70 shrink-0"
                    }
                  >
                    {has ? "Renseignée" : "Vide"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

