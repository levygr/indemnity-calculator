import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  deleteValeurRow,
  getEditionRows,
  listEditionsForRef,
  upsertValeurRow,
  type EditionRowItem,
} from "@/lib/referentiels/editions.functions";
import {
  applyCsvImport,
  previewCsvImport,
} from "@/lib/referentiels/csv-import.functions";
import { detectMatrixKind } from "@/lib/referentiels/csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ChevronLeft, FileUp, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute(
  "/_authenticated/referentiels/$code/editions/$editionId",
)({
  head: ({ params }) => ({
    meta: [
      {
        title: `Édition ${params.editionId.slice(0, 8)} — ${params.code}`,
      },
    ],
  }),
  component: EditionEditorPage,
});

function EditionEditorPage() {
  const { code, editionId } = Route.useParams();
  const listEds = useServerFn(listEditionsForRef);
  const rowsFn = useServerFn(getEditionRows);
  const upsert = useServerFn(upsertValeurRow);
  const del = useServerFn(deleteValeurRow);
  const queryClient = useQueryClient();
  const router = useRouter();

  const edsQuery = useQuery({
    queryKey: ["referentiels", code, "editions"],
    queryFn: () => listEds({ data: { code } }),
  });
  const edition = edsQuery.data?.find((e) => e.id === editionId);

  const rowsQuery = useQuery({
    queryKey: ["edition-rows", editionId],
    queryFn: () => rowsFn({ data: { editionId } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["edition-rows", editionId] });
    router.invalidate();
  };

  const upsertMutation = useMutation({
    mutationFn: (input: {
      rowId?: string;
      cle: unknown;
      valeur: unknown;
      commentaire?: string | null;
    }) => upsert({ data: { editionId, ...input } }),
    onSuccess: () => {
      toast.success("Ligne enregistrée.");
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement."),
  });

  const deleteMutation = useMutation({
    mutationFn: (rowId: string) => del({ data: { editionId, rowId } }),
    onSuccess: () => {
      toast.success("Ligne supprimée.");
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de la suppression."),
  });

  const isDraft = edition?.statut === "brouillon";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link
              to="/referentiels/$code"
              params={{ code }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-lg truncate">
              {edition?.libelle ?? "Édition"}
            </h1>
            <div className="text-xs text-muted-foreground">
              Référentiel : {code} · Statut : {edition?.statut ?? "…"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!isDraft && edition && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Édition en lecture seule</AlertTitle>
            <AlertDescription>
              Seules les éditions en statut « brouillon » sont modifiables.
              Créez un nouveau brouillon pour proposer des changements.
            </AlertDescription>
          </Alert>
        )}

        {rowsQuery.error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {rowsQuery.error instanceof Error
                ? rowsQuery.error.message
                : "Impossible de charger les lignes."}
            </AlertDescription>
          </Alert>
        )}

        {isDraft && detectMatrixKind(code) && (
          <CsvImportPanel code={code} editionId={editionId} />
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Lignes ({rowsQuery.data?.length ?? 0})
            </CardTitle>
            {isDraft && (
              <NewRowButton
                onCreate={(cle, valeur, commentaire) =>
                  upsertMutation.mutate({ cle, valeur, commentaire })
                }
                disabled={upsertMutation.isPending}
              />
            )}
          </CardHeader>
          <CardContent>
            {rowsQuery.isLoading && (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            )}
            {rowsQuery.data && rowsQuery.data.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucune ligne.</div>
            )}
            {rowsQuery.data && rowsQuery.data.length > 0 && (
              <div className="space-y-3">
                {rowsQuery.data.map((row) => (
                  <RowEditor
                    key={row.id}
                    row={row}
                    editable={isDraft}
                    onSave={(cle, valeur, commentaire) =>
                      upsertMutation.mutate({
                        rowId: row.id,
                        cle,
                        valeur,
                        commentaire,
                      })
                    }
                    onDelete={() => deleteMutation.mutate(row.id)}
                    busy={upsertMutation.isPending || deleteMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function parseJson(input: string): { ok: true; value: unknown } | { ok: false; err: string } {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    return { ok: false, err: (e as Error).message };
  }
}

function RowEditor({
  row,
  editable,
  onSave,
  onDelete,
  busy,
}: {
  row: EditionRowItem;
  editable: boolean;
  onSave: (cle: unknown, valeur: unknown, commentaire: string | null) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [cle, setCle] = useState(() => JSON.stringify(row.cle));
  const [valeur, setValeur] = useState(() =>
    JSON.stringify(row.valeur, null, 2),
  );
  const [commentaire, setCommentaire] = useState(row.commentaire ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setCle(JSON.stringify(row.cle));
    setValeur(JSON.stringify(row.valeur, null, 2));
    setCommentaire(row.commentaire ?? "");
    setDirty(false);
  }, [row.id, row.cle, row.valeur, row.commentaire]);

  const handleSave = () => {
    const pc = parseJson(cle);
    if (!pc.ok) return toast.error(`Clé invalide : ${pc.err}`);
    const pv = parseJson(valeur);
    if (!pv.ok) return toast.error(`Valeur invalide : ${pv.err}`);
    onSave(pc.value, pv.value, commentaire.trim() || null);
    setDirty(false);
  };

  return (
    <div className="border rounded-md p-3 space-y-2 bg-card">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <Label className="text-xs">Clé (JSON)</Label>
          <Input
            value={cle}
            onChange={(e) => {
              setCle(e.target.value);
              setDirty(true);
            }}
            disabled={!editable}
            className="font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Valeur (JSON)</Label>
          <Textarea
            value={valeur}
            onChange={(e) => {
              setValeur(e.target.value);
              setDirty(true);
            }}
            disabled={!editable}
            rows={Math.min(10, Math.max(2, valeur.split("\n").length))}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Commentaire</Label>
        <Input
          value={commentaire}
          onChange={(e) => {
            setCommentaire(e.target.value);
            setDirty(true);
          }}
          disabled={!editable}
          placeholder="Optionnel"
        />
      </div>
      {editable && (
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Supprimer cette ligne ?")) onDelete();
            }}
            disabled={busy}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Supprimer
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || busy}
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}

function NewRowButton({
  onCreate,
  disabled,
}: {
  onCreate: (cle: unknown, valeur: unknown, commentaire: string | null) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cle, setCle] = useState('{"type":"exemple"}');
  const [valeur, setValeur] = useState("null");
  const [commentaire, setCommentaire] = useState("");

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" />
        Nouvelle ligne
      </Button>
    );
  }

  return (
    <div className="w-full mt-2 border rounded-md p-3 space-y-2 bg-muted/40">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Nouvelle ligne</div>
        <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div>
        <Label className="text-xs">Clé (JSON)</Label>
        <Input
          value={cle}
          onChange={(e) => setCle(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
      <div>
        <Label className="text-xs">Valeur (JSON)</Label>
        <Textarea
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          rows={3}
          className="font-mono text-xs"
        />
      </div>
      <div>
        <Label className="text-xs">Commentaire</Label>
        <Input
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Optionnel"
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => {
            const pc = parseJson(cle);
            if (!pc.ok) return toast.error(`Clé invalide : ${pc.err}`);
            const pv = parseJson(valeur);
            if (!pv.ok) return toast.error(`Valeur invalide : ${pv.err}`);
            onCreate(pc.value, pv.value, commentaire.trim() || null);
            setOpen(false);
            setCle('{"type":"exemple"}');
            setValeur("null");
            setCommentaire("");
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Créer
        </Button>
      </div>
    </div>
  );
}
