import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReferentielsActifs } from "@/lib/referentiels/seed.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/referentiels/$code")({
  head: ({ params }) => ({
    meta: [{ title: `Référentiel ${params.code} — Victimes & Préjudices` }],
  }),
  component: ReferentielDetailPage,
});

function ReferentielDetailPage() {
  const { code } = Route.useParams();
  const list = useServerFn(listReferentielsActifs);
  const query = useQuery({
    queryKey: ["referentiels", "list"],
    queryFn: () => list(),
  });

  const ref = query.data?.find((r) => r.code === code);

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
                  {ref.kind === "incremental" ? "incrémental (ajouts de périodes)" : "monolithique (bloc figé)"}
                </div>
                {ref.description && (
                  <p className="text-muted-foreground pt-2 border-t">
                    {ref.description}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Valeurs ({ref.rows.length} ligne{ref.rows.length > 1 ? "s" : ""})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Affichage en lecture seule. L'édition cellule par cellule sera
                  disponible dans une prochaine étape.
                </p>
                <div className="max-h-[600px] overflow-auto border rounded-md">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 border-b">Clé</th>
                        <th className="text-left px-3 py-2 border-b">Valeur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ref.rows.slice(0, 500).map((row, i) => (
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
                  {ref.rows.length > 500 && (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      {ref.rows.length - 500} ligne(s) supplémentaire(s) non affichée(s).
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
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
      <pre className="whitespace-pre-wrap text-xs mt-2">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
