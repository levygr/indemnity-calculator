import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDossier } from "@/hooks/useDossier";
import { Section } from "@/components/vp/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculerSynthese, formatEuros, hydraterDossier } from "@/lib/calculs";
import { listTauxLegal } from "@/lib/taux-legal.functions";
import {
  calculerInterets,
  TauxLegalManquantError,
  type CategorieCreancier,
  type LigneTauxLegal,
} from "@/lib/calculs/interets";
import { formatDateFR } from "@/lib/calculs/format";
import { AlertTriangle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dossiers/$id/interets")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { dossier } = useDossier(id);

  const synthese = useMemo(
    () => (dossier ? calculerSynthese(hydraterDossier(dossier as unknown as Record<string, unknown>)) : null),
    [dossier],
  );

  const fetchTaux = useServerFn(listTauxLegal);
  const { data: taux, isLoading: loadingTaux, isError } = useQuery({
    queryKey: ["taux_legal"],
    queryFn: () => fetchTaux(),
  });

  const soldeVictime = synthese?.soldeVictime ?? 0;
  const [base, setBase] = useState<string>("");
  const [categorie, setCategorie] = useState<CategorieCreancier>("particulier");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>(
    (dossier?.dateLiquidation as string | null) ?? new Date().toISOString().slice(0, 10),
  );
  const [doublement, setDoublement] = useState(false);
  const [anatocisme, setAnatocisme] = useState(false);
  const [dateAnatocisme, setDateAnatocisme] = useState<string>("");

  // Base pré-remplie une fois la synthèse chargée si l'utilisateur n'a pas encore saisi
  const baseNum = base === "" ? soldeVictime : Number(base.replace(",", "."));

  const resultat = useMemo(() => {
    if (!taux || !dateDebut || !dateFin) return null;
    try {
      return {
        ok: true as const,
        value: calculerInterets({
          base: baseNum,
          dateDebut,
          dateFin,
          doublement,
          anatocisme,
          dateAnatocisme: anatocisme && dateAnatocisme ? dateAnatocisme : null,
          categorieCreancier: categorie,
          taux: taux as LigneTauxLegal[],
        }),
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof TauxLegalManquantError ? e.message : (e as Error).message,
      };
    }
  }, [baseNum, dateDebut, dateFin, doublement, anatocisme, dateAnatocisme, categorie, taux]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Intérêts au taux légal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calcul informatif. Ce module ne modifie pas la synthèse du dossier.
          Base pré-remplie avec le solde revenant à la victime ({formatEuros(soldeVictime)}).
        </p>
      </div>

      <Section title="Paramètres">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Base (€)</Label>
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder={String(soldeVictime)}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Catégorie de créancier</Label>
            <Select value={categorie} onValueChange={(v) => setCategorie(v as CategorieCreancier)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="particulier">
                  Personne physique n'agissant pas pour des besoins professionnels
                </SelectItem>
                <SelectItem value="autres">Autres cas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date de départ</Label>
            <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </div>
          <div>
            <Label>Date de fin</Label>
            <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2">
            <Checkbox checked={doublement} onCheckedChange={(v) => setDoublement(!!v)} />
            <span className="text-sm">
              <strong>Doublement du taux légal</strong> (art. L. 211-9 et L. 211-13 C. assur. :
              offre absente, tardive ou manifestement insuffisante)
            </span>
          </label>
          <label className="flex items-start gap-2">
            <Checkbox checked={anatocisme} onCheckedChange={(v) => setAnatocisme(!!v)} />
            <span className="text-sm">
              <strong>Capitalisation des intérêts</strong> (art. 1343-2 C. civ.)
            </span>
          </label>
          {anatocisme && (
            <div className="pl-6">
              <Label>Date de la demande de capitalisation</Label>
              <Input
                type="date"
                value={dateAnatocisme}
                onChange={(e) => setDateAnatocisme(e.target.value)}
                className="w-56"
              />
            </div>
          )}
        </div>
      </Section>

      <Section title="Résultat">
        {loadingTaux ? (
          <p className="text-sm text-muted-foreground">Chargement des taux…</p>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Taux inaccessibles</AlertTitle>
            <AlertDescription>Impossible de charger les taux d'intérêt légal.</AlertDescription>
          </Alert>
        ) : !dateDebut || !dateFin ? (
          <p className="text-sm text-muted-foreground">Renseignez les dates de début et de fin.</p>
        ) : !resultat ? null : !resultat.ok ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Taux légal manquant</AlertTitle>
            <AlertDescription>
              {resultat.error}
              <div className="mt-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/taux-legal">
                    Aller à l'écran Taux légal <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead>Doublé</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead className="text-right">Intérêts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultat.value.segments.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatDateFR(s.debut)} → {formatDateFR(s.fin)}</TableCell>
                    <TableCell>{s.tauxAnnuel.toString().replace(".", ",")} %</TableCell>
                    <TableCell>{s.doublement ? "Oui" : "—"}</TableCell>
                    <TableCell className="text-right">{formatEuros(s.base)}</TableCell>
                    <TableCell className="text-right">{s.jours}</TableCell>
                    <TableCell className="text-right">{formatEuros(s.interets)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {resultat.value.capitalisations.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Capitalisations (anatocisme)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date d'échéance</TableHead>
                      <TableHead className="text-right">Intérêts incorporés</TableHead>
                      <TableHead className="text-right">Nouvelle base</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultat.value.capitalisations.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatDateFR(c.date)}</TableCell>
                        <TableCell className="text-right">{formatEuros(c.interetsIncorpores)}</TableCell>
                        <TableCell className="text-right">{formatEuros(c.nouvelleBase)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-display font-semibold">Total des intérêts</span>
              <span className="font-display font-semibold text-lg">
                {formatEuros(resultat.value.totalInterets)}
              </span>
            </div>

            {resultat.value.references.length > 0 && (
              <div className="text-xs text-muted-foreground border-t pt-3">
                <div className="font-semibold mb-1">Arrêtés utilisés :</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {resultat.value.references.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
