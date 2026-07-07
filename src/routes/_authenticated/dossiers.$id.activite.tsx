import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listDossierEvents, type DossierEventWithUser } from "@/lib/dossiers.functions";
import { History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dossiers/$id/activite")({
  component: Page,
});

const ACTION_LABEL: Record<string, string> = {
  create: "Création du dossier",
  update: "Modification",
  delete: "Suppression du dossier",
  snapshot_create: "Création d'un chiffrage figé",
  snapshot_delete: "Suppression d'un chiffrage figé",
  export_pdf: "Export PDF",
  export_word: "Export Word",
  share: "Partage avec le cabinet",
  unshare: "Retrait du cabinet",
};

function describeDetails(action: string, details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  if (action === "update" && Array.isArray(d.keys)) {
    return `Sections modifiées : ${(d.keys as string[]).join(", ")}`;
  }
  if (action === "snapshot_create" && typeof d.nom === "string") return `« ${d.nom} »`;
  if (action === "snapshot_delete" && typeof d.nom === "string") return `« ${d.nom} »`;
  return null;
}

function Page() {
  const { id } = Route.useParams();
  const fetchList = useServerFn(listDossierEvents);
  const { data, isLoading } = useQuery({
    queryKey: ["dossier-events", id],
    queryFn: () => fetchList({ data: { dossierId: id } }),
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          JOURNAL D'ACTIVITÉ
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold flex items-center gap-2">
          <History className="w-5 h-5" />
          Activité du dossier
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trace horodatée des principales opérations effectuées sur ce dossier.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : !data || data.length === 0 ? (
        <div className="vp-card p-8 text-center text-muted-foreground">
          Aucune activité enregistrée.
        </div>
      ) : (
        <div className="vp-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left font-display">
              <tr>
                <th className="px-4 py-2 font-semibold w-48">Date</th>
                <th className="px-4 py-2 font-semibold">Utilisateur</th>
                <th className="px-4 py-2 font-semibold">Action</th>
                <th className="px-4 py-2 font-semibold">Détails</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e: DossierEventWithUser) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">{e.user_email ?? "—"}</td>
                  <td className="px-4 py-2">{ACTION_LABEL[e.action] ?? e.action}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {describeDetails(e.action, e.details) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
