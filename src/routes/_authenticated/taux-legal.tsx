import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  listTauxLegal,
  updateTauxLegal,
  addNextSemestreTauxLegal,
  type TauxLegalRow,
} from "@/lib/taux-legal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/calculs/format";
import { ArrowLeft, Plus, Check, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate as useNav } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/taux-legal")({
  component: TauxLegalPage,
});

function TauxLegalPage() {
  const qc = useQueryClient();
  const nav = useNav();
  const fetchList = useServerFn(listTauxLegal);
  const fetchAdd = useServerFn(addNextSemestreTauxLegal);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["taux_legal"],
    queryFn: () => fetchList(),
  });

  const mAdd = useMutation({
    mutationFn: () => fetchAdd({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taux_legal"] });
      toast.success("Semestre suivant ajouté");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-primary font-display tracking-wide">
              VICTIMES &amp; PRÉJUDICES
            </div>
            <h1 className="text-xl font-display font-semibold">Taux d'intérêt légal</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dossiers">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour aux dossiers
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                nav({ to: "/auth" });
              }}
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Alert className="mb-6 border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Vérification obligatoire</AlertTitle>
          <AlertDescription>
            Ces taux sont fixés par arrêté semestriel. Vérifiez chaque valeur
            contre l'arrêté publié au Journal officiel avant utilisation. Le
            moteur de calcul refuse toute période dont le taux est manquant.
          </AlertDescription>
        </Alert>

        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {rows?.length ?? 0} semestre{(rows?.length ?? 0) > 1 ? "s" : ""}
            {rows &&
              ` — ${rows.filter((r) => r.tauxParticulier != null && r.tauxAutres != null).length} renseigné(s)`}
          </p>
          <Button onClick={() => mAdd.mutate()} disabled={mAdd.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter le semestre suivant
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : (
          <div className="vp-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left font-display">
                <tr>
                  <th className="px-3 py-2 font-semibold">Période</th>
                  <th className="px-3 py-2 font-semibold">Taux particulier (%)</th>
                  <th className="px-3 py-2 font-semibold">Taux autres (%)</th>
                  <th className="px-3 py-2 font-semibold">Référence de l'arrêté</th>
                  <th className="px-3 py-2 font-semibold w-0">État</th>
                  <th className="px-3 py-2 w-0"></th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r) => <LigneEditable key={r.id} row={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function LigneEditable({ row }: { row: TauxLegalRow }) {
  const qc = useQueryClient();
  const fetchUpd = useServerFn(updateTauxLegal);
  const [particulier, setParticulier] = useState<string>(
    row.tauxParticulier == null ? "" : String(row.tauxParticulier),
  );
  const [autres, setAutres] = useState<string>(
    row.tauxAutres == null ? "" : String(row.tauxAutres),
  );
  const [reference, setReference] = useState<string>(row.reference ?? "");

  useEffect(() => {
    setParticulier(row.tauxParticulier == null ? "" : String(row.tauxParticulier));
    setAutres(row.tauxAutres == null ? "" : String(row.tauxAutres));
    setReference(row.reference ?? "");
  }, [row.id, row.tauxParticulier, row.tauxAutres, row.reference]);

  const m = useMutation({
    mutationFn: () =>
      fetchUpd({
        data: {
          id: row.id,
          tauxParticulier: particulier === "" ? null : Number(particulier.replace(",", ".")),
          tauxAutres: autres === "" ? null : Number(autres.replace(",", ".")),
          reference: reference.trim() === "" ? null : reference.trim(),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taux_legal"] });
      toast.success("Enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renseigne = row.tauxParticulier != null && row.tauxAutres != null;
  const dirty =
    (particulier === "" ? null : Number(particulier.replace(",", "."))) !== row.tauxParticulier ||
    (autres === "" ? null : Number(autres.replace(",", "."))) !== row.tauxAutres ||
    (reference.trim() === "" ? null : reference.trim()) !== (row.reference ?? null);

  return (
    <tr className="border-t">
      <td className="px-3 py-2 whitespace-nowrap font-medium">
        {formatDateFR(row.debut)} → {formatDateFR(row.fin)}
      </td>
      <td className="px-3 py-2">
        <Input
          value={particulier}
          onChange={(e) => setParticulier(e.target.value)}
          placeholder="—"
          className="h-8"
          inputMode="decimal"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={autres}
          onChange={(e) => setAutres(e.target.value)}
          placeholder="—"
          className="h-8"
          inputMode="decimal"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Arrêté du …"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2">
        {renseigne ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Renseigné
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Manquant
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <Button
          size="sm"
          variant={dirty ? "default" : "ghost"}
          disabled={!dirty || m.isPending}
          onClick={() => m.mutate()}
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          Enregistrer
        </Button>
      </td>
    </tr>
  );
}
