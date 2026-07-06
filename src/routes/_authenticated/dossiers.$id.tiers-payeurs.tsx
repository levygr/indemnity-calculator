import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Note, Section } from "@/components/vp/Field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  calculerSynthese,
  formatEuros,
  type CreanceTP,
  type OrganismeTP,
  type OrganismeTPType,
} from "@/lib/calculs";

export const Route = createFileRoute("/_authenticated/dossiers/$id/tiers-payeurs")({
  component: Page,
});

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string) { const x = Number(v); return isFinite(x) ? x : 0; }

const TYPES: { value: OrganismeTPType; label: string }[] = [
  { value: "cpam", label: "CPAM / assurance maladie" },
  { value: "mutuelle", label: "Mutuelle" },
  { value: "prevoyance", label: "Prévoyance" },
  { value: "employeur", label: "Employeur" },
  { value: "autre", label: "Autre" },
];

const POSTE_CODES = [
  "DSA", "FD", "ATP-T", "PGPA",
  "DSF", "ATP-P", "PGPF", "IP", "PSU", "LOG", "VEH",
  "OBS", "PRF", "FD-D", "ACC",
  "PRS", "FD-S",
];

function Page() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);
  const synth = useMemo(() => (dossier ? calculerSynthese(dossier) : null), [dossier]);
  if (!dossier || !synth) return null;

  const organismes = dossier.organismesTP;
  const creances = dossier.creancesTP;

  function addOrg() {
    update({ organismesTP: [...organismes, { id: uid(), nom: "", type: "cpam" }] });
  }
  function patchOrg(oid: string, p: Partial<OrganismeTP>) {
    update({ organismesTP: organismes.map((o) => (o.id === oid ? { ...o, ...p } : o)) });
  }
  function delOrg(oid: string) {
    update({
      organismesTP: organismes.filter((o) => o.id !== oid),
      creancesTP: creances.filter((c) => c.organismeId !== oid),
    });
  }

  function addCreance() {
    update({
      creancesTP: [
        ...creances,
        { id: uid(), organismeId: organismes[0]?.id ?? "", posteCode: "DSA", libelle: "", montantEchu: 0, montantAEchoir: 0 },
      ],
    });
  }
  function patchCreance(cid: string, p: Partial<CreanceTP>) {
    update({ creancesTP: creances.map((c) => (c.id === cid ? { ...c, ...p } : c)) });
  }
  function delCreance(cid: string) {
    update({ creancesTP: creances.filter((c) => c.id !== cid) });
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          TIERS PAYEURS
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">
          Recours des tiers payeurs (art. L. 376-1 CSS, art. 31 loi du 5 juillet 1985)
        </h1>
        <Note>
          Les créances ventilées ici ne remplacent pas les champs TP des postes : elles servent au
          contrôle poste par poste et alimenteront l'export.
        </Note>
      </header>

      <Section title="Organismes de tiers payeurs" description="Créer un organisme par débiteur de créance (CPAM, mutuelle, prévoyance, employeur…).">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-64">Type</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organismes.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Aucun organisme.</TableCell></TableRow>
              )}
              {organismes.map((o) => (
                <TableRow key={o.id} className="vp-row-alt">
                  <TableCell>
                    <Input value={o.nom} placeholder="Nom" onChange={(e) => patchOrg(o.id, { nom: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Select value={o.type} onValueChange={(v) => patchOrg(o.id, { type: v as OrganismeTPType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => delOrg(o.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={addOrg}><Plus className="w-4 h-4 mr-2" />Ajouter un organisme</Button>
        </div>
      </Section>

      <Section title="Créances ventilées poste par poste" description="Chaque ligne rattache une créance à un organisme et à un poste de la synthèse.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Organisme</TableHead>
                <TableHead className="w-32">Poste</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="w-40 text-right">Montant échu (€)</TableHead>
                <TableHead className="w-40 text-right">Montant à échoir (€)</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creances.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune créance ventilée.</TableCell></TableRow>
              )}
              {creances.map((c) => (
                <TableRow key={c.id} className="vp-row-alt">
                  <TableCell>
                    <Select value={c.organismeId} onValueChange={(v) => patchCreance(c.id, { organismeId: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {organismes.map((o) => <SelectItem key={o.id} value={o.id}>{o.nom || "(sans nom)"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={c.posteCode} onValueChange={(v) => patchCreance(c.id, { posteCode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {POSTE_CODES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={c.libelle} placeholder="Libellé" onChange={(e) => patchCreance(c.id, { libelle: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.01" className="text-right" value={c.montantEchu} onChange={(e) => patchCreance(c.id, { montantEchu: num(e.target.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.01" className="text-right" value={c.montantAEchoir} onChange={(e) => patchCreance(c.id, { montantAEchoir: num(e.target.value) })} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => delCreance(c.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={addCreance} disabled={organismes.length === 0}>
            <Plus className="w-4 h-4 mr-2" />Ajouter une créance
          </Button>
        </div>
      </Section>

      <Section title="Contrôles de cohérence" description="Écarts détectés entre les créances ventilées et le champ TP retenu dans chaque poste (seuil 1 €).">
        {synth.recoursTP.ecarts.length === 0 ? (
          <Note>Aucun écart détecté.</Note>
        ) : (
          <ul className="space-y-1 text-sm">
            {synth.recoursTP.ecarts.map((e) => (
              <li key={e.posteCode} className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>
                  <span className="font-semibold">{e.posteCode} — {e.libelle} :</span>{" "}
                  ventilé {formatEuros(e.ventile)} ≠ TP synthèse {formatEuros(e.tpSynthese)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
