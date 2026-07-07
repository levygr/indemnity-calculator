import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyOrganisation,
  createOrganisation,
  listMembers,
  addMemberByEmail,
  updateMemberRole,
  removeMember,
  type OrgRole,
} from "@/lib/organisations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Building2, LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/logo-vp.png.asset.json";

export const Route = createFileRoute("/_authenticated/cabinet")({
  component: CabinetPage,
});

const ROLE_LABEL: Record<OrgRole, string> = {
  admin: "Admin",
  avocat: "Avocat",
  assistant: "Assistant",
};

function CabinetPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMyOrg = useServerFn(getMyOrganisation);
  const fetchCreate = useServerFn(createOrganisation);

  const { data: myOrg, isLoading } = useQuery({
    queryKey: ["my-organisation"],
    queryFn: () => fetchMyOrg(),
  });

  const [nom, setNom] = useState("");
  const mCreate = useMutation({
    mutationFn: () => fetchCreate({ data: { nom } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-organisation"] });
      toast.success("Cabinet créé");
      setNom("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Victimes & Préjudices" className="w-11 h-11" />
            <div>
              <div className="text-xs font-semibold text-primary font-display tracking-wide">
                VICTIMES &amp; PRÉJUDICES
              </div>
              <h1 className="text-xl font-display font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Cabinet
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dossiers">Dossiers</Link>
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : !myOrg ? (
          <div className="vp-card p-8 max-w-xl">
            <h2 className="font-display font-semibold text-lg">Créer un cabinet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Créez un cabinet pour partager vos dossiers avec vos collaborateurs.
              Vous en serez automatiquement admin.
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Nom du cabinet"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />
              <Button
                onClick={() => mCreate.mutate()}
                disabled={mCreate.isPending || nom.trim().length === 0}
              >
                Créer
              </Button>
            </div>
          </div>
        ) : (
          <OrganisationView
            organisationId={myOrg.organisation.id}
            nom={myOrg.organisation.nom}
            myRole={myOrg.role}
          />
        )}
      </main>
    </div>
  );
}

function OrganisationView({
  organisationId,
  nom,
  myRole,
}: {
  organisationId: string;
  nom: string;
  myRole: OrgRole;
}) {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listMembers);
  const fetchAdd = useServerFn(addMemberByEmail);
  const fetchRole = useServerFn(updateMemberRole);
  const fetchRemove = useServerFn(removeMember);

  const { data: members } = useQuery({
    queryKey: ["members", organisationId],
    queryFn: () => fetchMembers({ data: { organisationId } }),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("avocat");

  const mAdd = useMutation({
    mutationFn: () => fetchAdd({ data: { organisationId, email, role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", organisationId] });
      toast.success("Membre ajouté");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mRole = useMutation({
    mutationFn: (p: { userId: string; role: OrgRole }) =>
      fetchRole({ data: { organisationId, userId: p.userId, role: p.role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", organisationId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const mRemove = useMutation({
    mutationFn: (userId: string) =>
      fetchRemove({ data: { organisationId, userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", organisationId] });
      toast.success("Membre retiré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isAdmin = myRole === "admin";

  return (
    <div className="space-y-6">
      <div className="vp-card p-6">
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          CABINET
        </div>
        <h2 className="mt-1 text-2xl font-display font-semibold">{nom}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Votre rôle : <span className="font-semibold">{ROLE_LABEL[myRole]}</span>
        </p>
      </div>

      <div className="vp-card overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-display font-semibold">Membres</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left font-display">
            <tr>
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold w-40">Rôle</th>
              <th className="px-4 py-2 w-0"></th>
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.user_id} className="border-t">
                <td className="px-4 py-2">{m.email ?? m.user_id}</td>
                <td className="px-4 py-2">
                  {isAdmin ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        mRole.mutate({ userId: m.user_id, role: v as OrgRole })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="avocat">Avocat</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    ROLE_LABEL[m.role]
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est réversible mais retire immédiatement
                            l'accès de {m.email ?? "ce membre"} à tous les dossiers du cabinet.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => mRemove.mutate(m.user_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Retirer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="vp-card p-6">
          <h3 className="font-display font-semibold">Ajouter un membre</h3>
          <p className="text-sm text-muted-foreground mt-1">
            La personne doit déjà avoir un compte sur l'application.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
            <div>
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@cabinet.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role" className="text-xs">Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="avocat">Avocat</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => mAdd.mutate()}
                disabled={mAdd.isPending || !email.includes("@")}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
