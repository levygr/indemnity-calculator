import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Copy, Plus, Trash2, LogOut, FileText, Building2, User2, Share2, Search } from "lucide-react";
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

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "reference">("updated");

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.reference.toLowerCase().includes(q)) : rows;
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "reference") return a.reference.localeCompare(b.reference);
      if (sortBy === "created") return b.created_at.localeCompare(a.created_at);
      return b.updated_at.localeCompare(a.updated_at);
    });
    return sorted;
  }, [rows, search, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoAsset.url} alt="Victimes & Préjudices" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs font-semibold text-primary font-display tracking-wide">
                VICTIMES &amp; PRÉJUDICES
              </div>
              <h1 className="text-lg sm:text-xl font-display font-semibold truncate">Vos dossiers</h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button asChild variant="ghost" size="sm" className="min-h-11 hidden sm:inline-flex">
              <Link to="/cabinet">
                <Building2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Cabinet</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="min-h-11 hidden sm:inline-flex">
              <Link to="/taux-legal">Taux légal</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Déconnexion"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4 sm:hidden flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1 min-h-11">
            <Link to="/cabinet">Cabinet</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1 min-h-11">
            <Link to="/taux-legal">Taux légal</Link>
          </Button>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Rechercher une référence…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 min-h-11"
                aria-label="Rechercher un dossier"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-full sm:w-56 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Dernière modification</SelectItem>
                <SelectItem value="created">Date de création</SelectItem>
                <SelectItem value="reference">Référence (A → Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => mCreate.mutate()} disabled={mCreate.isPending} className="min-h-11 shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau dossier
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          {filteredRows.length} dossier{filteredRows.length > 1 ? "s" : ""}
          {search && rows ? ` sur ${rows.length}` : ""}
        </p>

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : !rows || rows.length === 0 ? (
          <div className="vp-card p-8 sm:p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-display font-semibold text-lg">Aucun dossier</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Commencez par créer un premier dossier d'indemnisation.
            </p>
            <Button className="mt-4 min-h-11" onClick={() => mCreate.mutate()}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un dossier
            </Button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="vp-card p-8 text-center text-sm text-muted-foreground">
            Aucun dossier ne correspond à « {search} ».
          </div>
        ) : (
          <>
            {/* Vue tableau (≥ md) */}
            <div className="vp-card overflow-hidden hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left font-display">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Référence</th>
                    <th className="px-4 py-3 font-semibold w-32">Portée</th>
                    <th className="px-4 py-3 font-semibold">Fait générateur</th>
                    <th className="px-4 py-3 font-semibold">Créé le</th>
                    <th className="px-4 py-3 font-semibold">Modifié le</th>
                    <th className="px-4 py-3 font-semibold w-0"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <DossierLine
                      key={r.id}
                      row={r}
                      myOrgId={myOrg?.organisation.id ?? null}
                      myOrgName={myOrg?.organisation.nom ?? null}
                      onDelete={() => mDelete.mutate(r.id)}
                      onDuplicate={() => mDup.mutate(r.id)}
                      onShare={(organisationId) =>
                        mShare.mutate({ dossierId: r.id, organisationId })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vue cartes (< md) */}
            <div className="md:hidden space-y-3">
              {filteredRows.map((r) => (
                <DossierCard
                  key={r.id}
                  row={r}
                  myOrgId={myOrg?.organisation.id ?? null}
                  onDelete={() => mDelete.mutate(r.id)}
                  onDuplicate={() => mDup.mutate(r.id)}
                  onShare={(organisationId) =>
                    mShare.mutate({ dossierId: r.id, organisationId })
                  }
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}



function DossierLine({
  row,
  myOrgId,
  myOrgName,
  onDelete,
  onDuplicate,
  onShare,
}: {
  row: DossierRow;
  myOrgId: string | null;
  myOrgName: string | null;
  onDelete: () => void;
  onDuplicate: () => void;
  onShare: (organisationId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const fg = (row.data as { faitGenerateur?: string })?.faitGenerateur ?? "—";
  const isShared = !!row.organisation_id;
  const canToggleShare = !!myOrgId;
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
      <td className="px-4 py-3">
        {isShared ? (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-display"
            title={myOrgName ?? undefined}
          >
            <Building2 className="w-3 h-3" />
            Cabinet
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-display">
            <User2 className="w-3 h-3" />
            Personnel
          </span>
        )}
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
        {canToggleShare && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShare(isShared ? null : myOrgId)}
            title={isShared ? "Repasser en personnel" : "Partager avec le cabinet"}
          >
            <Share2 className={`w-4 h-4 ${isShared ? "text-primary" : ""}`} />
          </Button>
        )}
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

function DossierCard({
  row,
  myOrgId,
  onDelete,
  onDuplicate,
  onShare,
}: {
  row: DossierRow;
  myOrgId: string | null;
  onDelete: () => void;
  onDuplicate: () => void;
  onShare: (organisationId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const fg = (row.data as { faitGenerateur?: string })?.faitGenerateur ?? "—";
  const isShared = !!row.organisation_id;
  const canToggleShare = !!myOrgId;
  return (
    <div className="vp-card p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/dossiers/$id"
          params={{ id: row.id }}
          className="font-display font-semibold text-foreground hover:text-primary min-w-0 flex-1 truncate"
        >
          {row.reference}
        </Link>
        {isShared ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-display shrink-0">
            <Building2 className="w-3 h-3" />
            Cabinet
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-display shrink-0">
            <User2 className="w-3 h-3" />
            Perso
          </span>
        )}
      </div>
      <div className="mt-2 text-xs text-muted-foreground capitalize">
        {fg.replace(/_/g, " ")}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Modifié le {formatDateFR(row.updated_at.slice(0, 10))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1">
        {canToggleShare && (
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => onShare(isShared ? null : myOrgId)}
            aria-label={isShared ? "Repasser en personnel" : "Partager avec le cabinet"}
          >
            <Share2 className={`w-4 h-4 ${isShared ? "text-primary" : ""}`} />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onDuplicate} aria-label="Dupliquer">
          <Copy className="w-4 h-4" />
        </Button>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Supprimer">
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
      </div>
    </div>
  );
}


