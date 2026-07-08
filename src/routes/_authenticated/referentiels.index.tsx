import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listReferentielsActifs,
  seedReferentiels,
} from "@/lib/referentiels/seed.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ChevronRight, Database, RefreshCw, Home } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/referentiels/")({
  head: () => ({
    meta: [
      { title: "Référentiels — Victimes & Préjudices" },
      {
        name: "description",
        content:
          "Liste des barèmes et référentiels utilisés par l'application, avec leur édition active.",
      },
    ],
  }),
  component: ReferentielsListPage,
});

function ReferentielsListPage() {
  const list = useServerFn(listReferentielsActifs);
  const seed = useServerFn(seedReferentiels);
  const queryClient = useQueryClient();
  const router = useRouter();

  const query = useQuery({
    queryKey: ["referentiels", "list"],
    queryFn: () => list(),
  });

  const seedMutation = useMutation({
    mutationFn: () => seed(),
    onSuccess: (rapports) => {
      const nouveaux = rapports.filter((r) => r.action === "seedee").length;
      toast.success(
        nouveaux > 0
          ? `${nouveaux} référentiel(s) initialisé(s).`
          : "Aucun nouveau référentiel à initialiser.",
      );
      queryClient.invalidateQueries({ queryKey: ["referentiels"] });
      router.invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Échec du seed.");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dossiers">
              <Home className="w-4 h-4 mr-2" />
              Dossiers
            </Link>
          </Button>
          <h1 className="font-display font-semibold text-lg">Référentiels</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Barèmes et référentiels utilisés pour les calculs. Chaque référentiel
          possède une <strong>édition active</strong> qui sert de référence.
          Les valeurs sont consultables ici. L'édition qui a servi à chiffrer
          un dossier lui est épinglée : ses montants ne changent jamais
          silencieusement lorsqu'une nouvelle édition est activée.
        </p>

        {query.isLoading && (
          <div className="text-muted-foreground">Chargement…</div>
        )}
        {query.error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {query.error instanceof Error
                ? query.error.message
                : "Impossible de charger les référentiels."}
            </AlertDescription>
          </Alert>
        )}

        {query.data && query.data.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Base vide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Aucun référentiel n'a encore été initialisé en base. Un
                administrateur peut lancer le seed initial ci-dessous. Cette
                opération ne modifie aucune valeur : elle recopie les fichiers
                seed livrés avec l'application dans une édition « Seed initial »
                marquée comme active. Réservé aux administrateurs.
              </p>
              <Button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${
                    seedMutation.isPending ? "animate-spin" : ""
                  }`}
                />
                Lancer le seed initial
              </Button>
            </CardContent>
          </Card>
        )}

        {query.data && query.data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {query.data.map((r) => (
              <Card key={r.code} className="hover:border-primary/40 transition">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-start justify-between gap-2">
                    <span className="truncate">{r.libelle}</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 font-display">
                      {r.kind === "incremental" ? "incrémental" : "monolithique"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground line-clamp-2">
                    {r.description || r.source || "—"}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      <span className="font-medium text-foreground">Édition active :</span>{" "}
                      {r.editionLibelle ?? "aucune"}
                    </div>
                    {r.editionActivatedAt && (
                      <div>
                        Activée le{" "}
                        {format(new Date(r.editionActivatedAt), "d MMMM yyyy", {
                          locale: fr,
                        })}
                      </div>
                    )}
                    <div>
                      {r.rows.length} ligne{r.rows.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link
                      to="/referentiels/$code"
                      params={{ code: r.code }}
                      className="flex items-center justify-between"
                    >
                      Consulter
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {query.data && query.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4" />
                Administration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Le seed initial est idempotent : relancé, il ne recrée rien
                pour les référentiels ayant déjà une édition active.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${
                    seedMutation.isPending ? "animate-spin" : ""
                  }`}
                />
                Relancer le seed (référentiels manquants)
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
