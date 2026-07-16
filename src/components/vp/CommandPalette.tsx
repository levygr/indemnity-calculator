/**
 * Palette de navigation (Ctrl / Cmd + K).
 *
 * - Accès rapide aux sections du dossier courant.
 * - Sauts vers d'autres dossiers (référence).
 * - Ouvre également l'écran des taux légaux / cabinet / référentiels.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { SECTIONS } from "@/lib/dossier/pageStatus";
import { listDossiers } from "@/lib/dossiers.functions";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { id?: string };
  const currentId = params.id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchDossiers = useServerFn(listDossiers);
  const { data: dossiers } = useQuery({
    queryKey: ["dossiers-palette"],
    queryFn: () => fetchDossiers(),
    enabled: open,
    staleTime: 30_000,
  });

  function go(to: string) {
    setOpen(false);
    // navigate accepte les chemins concrets ; pas de type strict ici pour la palette
    navigate({ to: to as never });
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher une section, un dossier…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        {currentId && (
          <>
            <CommandGroup heading="Dossier courant">
              {SECTIONS.map((s) => (
                <CommandItem
                  key={s.key}
                  value={`${s.label} ${s.group}`}
                  onSelect={() => go(s.route.replace("$id", currentId))}
                >
                  <span className="text-xs text-muted-foreground mr-2">{s.group}</span>
                  {s.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Général">
          <CommandItem value="dossiers" onSelect={() => go("/dossiers")}>Liste des dossiers</CommandItem>
          <CommandItem value="taux legal" onSelect={() => go("/taux-legal")}>Taux légal</CommandItem>
          <CommandItem value="cabinet" onSelect={() => go("/cabinet")}>Cabinet</CommandItem>
          <CommandItem value="referentiels" onSelect={() => go("/referentiels")}>Référentiels</CommandItem>
        </CommandGroup>
        {(dossiers ?? []).length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Autres dossiers">
              {(dossiers ?? [])
                .filter((d) => d.id !== currentId)
                .slice(0, 20)
                .map((d) => (
                  <CommandItem
                    key={d.id}
                    value={d.reference || d.id}
                    onSelect={() => go(`/dossiers/${d.id}`)}
                  >
                    {d.reference || "Sans référence"}
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
