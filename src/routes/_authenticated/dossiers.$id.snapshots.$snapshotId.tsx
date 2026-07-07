import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock } from "lucide-react";
import { Section } from "@/components/vp/Field";
import { Button } from "@/components/ui/button";
import { SyntheseTotaux, SyntheseCategories } from "@/components/vp/SyntheseTables";
import { getSnapshot } from "@/lib/dossiers.functions";
import type { Synthese } from "@/lib/calculs/postes/synthese";

export const Route = createFileRoute(
  "/_authenticated/dossiers/$id/snapshots/$snapshotId",
)({
  component: Page,
});

function Page() {
  const { id, snapshotId } = Route.useParams();
  const fetch = useServerFn(getSnapshot);
  const { data, isLoading, error } = useQuery({
    queryKey: ["snapshot", snapshotId],
    queryFn: () => fetch({ data: { id: snapshotId } }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Chargement du chiffrage figé…</div>;
  if (error || !data) {
    return (
      <div className="p-8 space-y-4">
        <div className="text-destructive">Chiffrage figé introuvable.</div>
        <Link to="/dossiers/$id/synthese" params={{ id }}>
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Retour à la synthèse</Button>
        </Link>
      </div>
    );
  }

  const synth = data.synthese as unknown as Synthese;
  const dateFige = new Date(data.created_at).toLocaleString("fr-FR");

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-display font-semibold text-primary tracking-wide">
            CHIFFRAGE FIGÉ
          </div>
          <h1 className="mt-1 text-2xl font-display font-semibold">{data.nom}</h1>
        </div>
        <Link to="/dossiers/$id/synthese" params={{ id }}>
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Retour à la synthèse</Button>
        </Link>
      </div>

      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 flex items-center gap-2 text-sm font-display">
        <Lock className="w-4 h-4" />
        <span>Chiffrage figé le {dateFige}, non modifiable.</span>
      </div>

      <SyntheseTotaux synth={synth} />
      <SyntheseCategories synth={synth} />

      {synth.avertissements && synth.avertissements.length > 0 && (
        <Section title={`Contrôles de cohérence à la date du chiffrage (${synth.avertissements.length})`}>
          <ul className="space-y-1 text-sm">
            {synth.avertissements.map((a, i) => (
              <li key={i}>
                <span className="font-semibold">{a.poste} :</span> {a.message}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
