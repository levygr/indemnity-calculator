import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listDossiers,
  createDossier,
  deleteDossier,
  duplicateDossier,
  attachDossierToOrganisation,
  type DossierRow,
} from "@/lib/dossiers.functions";
import { getMyOrganisation } from "@/lib/organisations.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDateFR } from "@/lib/calculs/format";
import { Copy, Plus, Trash2, LogOut, FileText, Building2, User2, Share2 } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/logo-vp.png.asset.json";


export const Route = createFileRoute("/_authenticated/dossiers/")({
  component: DossiersList,
});

function DossiersList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchList = useServerFn(listDossiers);
  const fetchCreate = useServerFn(createDossier);
  const fetchDelete = useServerFn(deleteDossier);
  const fetchDup = useServerFn(duplicateDossier);

  const fetchMyOrg = useServerFn(getMyOrganisation);
  const fetchAttach = useServerFn(attachDossierToOrganisation);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["dossiers"],
    queryFn: () => fetchList(),
  });
  const { data: myOrg } = useQuery({
    queryKey: ["my-organisation"],
    queryFn: () => fetchMyOrg(),
  });

  const mCreate = useMutation({
    mutationFn: () => fetchCreate({ data: {} }),
    onSuccess: (row: DossierRow) => {
      qc.invalidateQueries({ queryKey: ["dossiers"] });
      navigate({ to: "/dossiers/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => fetchDelete({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("Dossier supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDup = useMutation({
    mutationFn: (id: string) => fetchDup({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dossiers"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const mShare = useMutation({
    mutationFn: (p: { dossierId: string; organisationId: string | null }) =>
      fetchAttach({ data: p }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success(vars.organisationId ? "Dossier partagé avec le cabinet" : "Dossier repassé en personnel");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Victimes & Préjudices" className="w-11 h-11 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-primary font-display tracking-wide">
                VICTIMES &amp; PRÉJUDICES
              </div>
              <h1 className="text-xl font-display font-semibold">Vos dossiers</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/cabinet">
                <Building2 className="w-4 h-4 mr-2" />
                Cabinet
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/taux-legal">Taux légal</Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {rows?.length ?? 0} dossier{(rows?.length ?? 0) > 1 ? "s" : ""}
          </p>
          <Button onClick={() => mCreate.mutate()} disabled={mCreate.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau dossier
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : !rows || rows.length === 0 ? (
          <div className="vp-card p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-display font-semibold text-lg">Aucun dossier</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Commencez par créer un premier dossier d'indemnisation.
            </p>
            <Button className="mt-4" onClick={() => mCreate.mutate()}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un dossier
            </Button>
          </div>
        ) : (
          <div className="vp-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left font-display">
                <tr>
                  <th className="px-4 py-3 font-semibold">Référence</th>
                  <th className="px-4 py-3 font-semibold">Fait générateur</th>
                  <th className="px-4 py-3 font-semibold">Créé le</th>
                  <th className="px-4 py-3 font-semibold">Modifié le</th>
                  <th className="px-4 py-3 font-semibold w-0"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <DossierLine
                    key={r.id}
                    row={r}
                    onDelete={() => mDelete.mutate(r.id)}
                    onDuplicate={() => mDup.mutate(r.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function DossierLine({
  row,
  onDelete,
  onDuplicate,
}: {
  row: DossierRow;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const fg = (row.data as { faitGenerateur?: string })?.faitGenerateur ?? "—";
  return (
    <tr className="border-t hover:bg-muted/40">
      <td className="px-4 py-3">
        <Link
          to="/dossiers/$id"
          params={{ id: row.id }}
          className="font-medium text-foreground hover:text-primary"
        >
          {row.reference}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground capitalize">
        {fg.replace(/_/g, " ")}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDateFR(row.created_at.slice(0, 10))}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDateFR(row.updated_at.slice(0, 10))}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Button variant="ghost" size="sm" onClick={onDuplicate} title="Dupliquer">
          <Copy className="w-4 h-4" />
        </Button>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" title="Supprimer">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce dossier ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le dossier « {row.reference} » sera
                définitivement supprimé.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete();
                  setOpen(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>
  );
}
