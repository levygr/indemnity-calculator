import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listReferentielsActifs } from "@/lib/referentiels/seed.functions";
import {
  activateEdition,
  archiveEdition,
  canEditReferentiels,
  createDraftEdition,
  deleteDraftEdition,
  listEditionsForRef,
} from "@/lib/referentiels/editions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ChevronLeft, Pencil, Play, Archive, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/referentiels/$code")({
  head: ({ params }) => ({
    meta: [{ title: `Référentiel ${params.code} — Victimes & Préjudices` }],
  }),
  component: ReferentielDetailPage,
});

function ReferentielDetailPage() {
  const { code } = Route.useParams();
  const list = useServerFn(listReferentielsActifs);
  const listEds = useServerFn(listEditionsForRef);
  const canEdit = useServerFn(canEditReferentiels);
  const query = useQuery({
    queryKey: ["referentiels", "list"],
    queryFn: () => list(),
  });
  const editionsQuery = useQuery({
    queryKey: ["referentiels", code, "editions"],
    queryFn: () => listEds({ data: { code } }),
  });
  const canEditQuery = useQuery({
    queryKey: ["referentiels", "canEdit"],
    queryFn: () => canEdit(),
    staleTime: 5 * 60_000,
  });

  const ref = query.data?.find((r) => r.code === code);
  const isAdmin = canEditQuery.data === true;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/referentiels">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Référentiels
            </Link>
          </Button>
          <h1 className="font-display font-semibold text-lg truncate">
            {ref?.libelle || code}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {query.isLoading && <div className="text-muted-foreground">Chargement…</div>}
        {query.error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {query.error instanceof Error
                ? query.error.message
                : "Impossible de charger le référentiel."}
            </AlertDescription>
          </Alert>
        )}
        {query.data && !ref && (
          <Alert>
            <AlertTitle>Référentiel introuvable</AlertTitle>
            <AlertDescription>
              Le code « {code} » n'est pas présent en base. Vérifiez que le seed
              initial a bien été exécuté depuis la page des référentiels.
            </AlertDescription>
          </Alert>
        )}
        {ref && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Édition active</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>
                  <span className="font-medium">Libellé :</span>{" "}
                  {ref.editionLibelle ?? "aucune"}
                </div>
                {ref.editionActivatedAt && (
                  <div>
                    <span className="font-medium">Activée le :</span>{" "}
                    {format(new Date(ref.editionActivatedAt), "d MMMM yyyy à HH:mm", {
                      locale: fr,
                    })}
                  </div>
                )}
                <div>
                  <span className="font-medium">Source :</span>{" "}
                  {ref.source || "—"}
                </div>
                <div>
                  <span className="font-medium">Type :</span>{" "}
                  {ref.kind === "incremental"
                    ? "incrémental (ajouts de périodes)"
                    : "monolithique (bloc figé)"}
                </div>
                {ref.description && (
                  <p className="text-muted-foreground pt-2 border-t">
                    {ref.description}
                  </p>
                )}
              </CardContent>
            </Card>

            <EditionsPanel
              code={code}
              editions={editionsQuery.data ?? []}
              isLoading={editionsQuery.isLoading}
              isAdmin={isAdmin}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Valeurs de l'édition active ({ref.rows.length} ligne
                  {ref.rows.length > 1 ? "s" : ""})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Lecture seule. Pour modifier, créez un brouillon dans le
                  panneau ci-dessus.
                </p>
                <RowsTable rows={ref.rows.slice(0, 500)} />
                {ref.rows.length > 500 && (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    {ref.rows.length - 500} ligne(s) supplémentaire(s) non
                    affichée(s).
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function statutBadge(statut: string) {
  if (statut === "actif")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Actif</Badge>;
  if (statut === "brouillon")
    return <Badge variant="secondary">Brouillon</Badge>;
  return <Badge variant="outline">Archivé</Badge>;
}

function EditionsPanel({
  code,
  editions,
  isLoading,
  isAdmin,
}: {
  code: string;
  editions: import("@/lib/referentiels/editions.functions").EditionListItem[];
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createDraft = useServerFn(createDraftEdition);
  const activate = useServerFn(activateEdition);
  const archive = useServerFn(archiveEdition);
  const deleteDraft = useServerFn(deleteDraftEdition);

  const [openCreate, setOpenCreate] = useState(false);
  const [draftLibelle, setDraftLibelle] = useState("");
  const [draftSource, setDraftSource] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["referentiels"] });
    router.invalidate();
  };

  const createMutation = useMutation({
    mutationFn: (input: { libelle: string; source: string }) =>
      createDraft({
        data: {
          code,
          libelle: input.libelle,
          source: input.source || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Brouillon créé à partir de l'édition active.");
      setOpenCreate(false);
      setDraftLibelle("");
      setDraftSource("");
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de la création."),
  });

  const activateMutation = useMutation({
    mutationFn: (editionId: string) => activate({ data: { editionId } }),
    onSuccess: () => {
      toast.success("Édition activée. L'édition précédente a été archivée.");
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de l'activation."),
  });

  const archiveMutation = useMutation({
    mutationFn: (editionId: string) => archive({ data: { editionId } }),
    onSuccess: () => {
      toast.success("Édition archivée.");
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de l'archivage."),
  });

  const deleteMutation = useMutation({
    mutationFn: (editionId: string) => deleteDraft({ data: { editionId } }),
    onSuccess: () => {
      toast.success("Brouillon supprimé.");
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de la suppression."),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Éditions</CardTitle>
        {isAdmin && (
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Nouveau brouillon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une édition brouillon</DialogTitle>
                <DialogDescription>
                  Les lignes de l'édition actuellement active seront copiées
                  dans le brouillon. Vous pourrez les modifier avant activation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ed-libelle">Libellé</Label>
                  <Input
                    id="ed-libelle"
                    placeholder="Ex. Barème 2026"
                    value={draftLibelle}
                    onChange={(e) => setDraftLibelle(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ed-source">Source (optionnel)</Label>
                  <Input
                    id="ed-source"
                    placeholder="Ex. Gazette du Palais — Barème 2026"
                    value={draftSource}
                    onChange={(e) => setDraftSource(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenCreate(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() =>
                    createMutation.mutate({
                      libelle: draftLibelle.trim(),
                      source: draftSource.trim(),
                    })
                  }
                  disabled={createMutation.isPending || !draftLibelle.trim()}
                >
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-muted-foreground text-sm">Chargement…</div>}
        {!isLoading && editions.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Aucune édition. Lancez le seed initial depuis la page des
            référentiels.
          </div>
        )}
        {editions.length > 0 && (
          <div className="border rounded-md divide-y">
            {editions.map((ed) => (
              <div
                key={ed.id}
                className="flex flex-wrap items-center gap-3 p-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{ed.libelle}</span>
                    {statutBadge(ed.statut)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Créée le{" "}
                    {format(new Date(ed.created_at), "d MMM yyyy", { locale: fr })}
                    {ed.activated_at && (
                      <>
                        {" · "}activée le{" "}
                        {format(new Date(ed.activated_at), "d MMM yyyy", {
                          locale: fr,
                        })}
                      </>
                    )}
                    {ed.source && <> · {ed.source}</>}
                  </div>
                </div>
                {isAdmin && ed.statut === "brouillon" && (
                  <>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        to="/referentiels/$code/editions/$editionId"
                        params={{ code, editionId: ed.id }}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Éditer
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate(ed.id)}
                      disabled={activateMutation.isPending}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Activer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer le brouillon « ${ed.libelle} » ? Cette action est irréversible.`,
                          )
                        )
                          deleteMutation.mutate(ed.id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                {isAdmin && ed.statut === "archive" && (
                  <span className="text-xs text-muted-foreground">
                    Archivée — lecture seule
                  </span>
                )}
                {isAdmin && ed.statut === "actif" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        confirm(
                          "Archiver l'édition active nécessite d'activer d'abord une autre édition. Continuer ?",
                        )
                      )
                        archiveMutation.mutate(ed.id);
                    }}
                    disabled={archiveMutation.isPending}
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" />
                    Archiver
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RowsTable({
  rows,
}: {
  rows: { cle: unknown; valeur: unknown }[];
}) {
  const sorted = useMemo(() => rows, [rows]);
  return (
    <div className="max-h-[600px] overflow-auto border rounded-md">
      <table className="w-full text-xs font-mono">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 border-b">Clé</th>
            <th className="text-left px-3 py-2 border-b">Valeur</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b hover:bg-muted/40">
              <td className="px-3 py-1.5 align-top whitespace-nowrap text-muted-foreground">
                {JSON.stringify(row.cle)}
              </td>
              <td className="px-3 py-1.5 align-top break-all">
                <ValeurPreview value={row.valeur} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValeurPreview({ value }: { value: unknown }) {
  const s = JSON.stringify(value);
  if (s.length <= 200) return <span>{s}</span>;
  return (
    <details>
      <summary className="cursor-pointer text-muted-foreground">
        {s.slice(0, 160)}… <span className="text-primary">(déplier)</span>
      </summary>
      <pre className="whitespace-pre-wrap text-xs mt-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
