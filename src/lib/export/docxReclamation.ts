/**
 * Génération d'un export Word (.docx) de la réclamation chiffrée.
 * Pur, sans dépendance UI ni réseau ; le téléchargement est délégué à
 * l'appelant (voir `downloadDocx`).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
  type ISectionOptions,
} from "docx";
import { saveAs } from "file-saver";

import type {
  Categorie,
  DossierData,
  Synthese,
  LigneSynthese,
} from "@/lib/calculs";
import { CATEGORIE_LABEL } from "@/lib/calculs";
import { AIPP_META } from "@/data/bareme_aipp";
import { REFERENTIEL } from "@/data/referentiel_evaluation";

// ============================================================
// Formatage FR (indépendant d'Intl pour un rendu stable en tests)
// ============================================================

/**
 * Formate un nombre en montant euros FR :
 *   1234567.5 → "1 234 567,50 €"
 *   0        → "0,00 €"
 *   NaN/null → "—"
 * Utilise l'espace insécable U+00A0 pour les milliers et devant €.
 */
export function formatEurosDocx(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const NBSP = "\u00A0";
  const negatif = v < 0;
  const abs = Math.abs(v);
  const arrondi = Math.round(abs * 100) / 100;
  const [entier, dec = "00"] = arrondi.toFixed(2).split(".");
  const entierFmt = entier.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${negatif ? "−" : ""}${entierFmt},${dec}${NBSP}€`;
}

function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const TABLE_LABEL: Record<string, string> = {
  "2020-2022": "stationnaire INSEE 2020-2022",
  "2023-2025": "prospective INSEE 2021-2121",
};

// ============================================================
// Assemblage du document
// ============================================================

const ORDRE: Categorie[] = ["PT", "EPT", "PP", "EPP", "DECES", "SURVIE"];

/** Postes ayant droit à un encadré de démonstration (capitalisation). */
const CAPITALISABLES = new Set([
  "ATP-P",
  "PGPF",
  "DSF",
  "LOG",
  "VEH",
  "PRF",
  "PRS",
  "IP",
]);

export interface BuildOptions {
  dossier: DossierData;
  synthese: Synthese;
  /** Logo optionnel (PNG ou JPEG bufferisé). */
  logo?: { data: Uint8Array; type: "png" | "jpg" } | null;
  /** Date d'édition, par défaut aujourd'hui. */
  dateEdition?: string;
}

export interface BuildResult {
  document: Document;
  nbSections: number;
  categoriesRendues: Categorie[];
  aPointsDeVigilance: boolean;
  demonstrationCodes: string[];
}

/**
 * Assemble la structure du document. Renvoie également un descripteur des
 * éléments produits pour permettre les tests structurels.
 */
export function buildReclamationDocx(opts: BuildOptions): BuildResult {
  const { dossier, synthese } = opts;
  const dateEdition = opts.dateEdition ?? new Date().toISOString().slice(0, 10);

  const categoriesRendues: Categorie[] = ORDRE.filter((cat) =>
    synthese.lignes.some((l) => l.categorie === cat && l.montant !== 0),
  );

  // Une seule section : la même mise en page couvre toutes les pages,
  // et l'en-tête w:titlePg n'apparaît qu'à partir de la page 2.
  const children: Paragraph[] = [];
  const tables: Table[] = [];
  const demonstrationCodes: string[] = [];

  // --- Page de garde ---
  const gardeChildren: Array<Paragraph | Table> = [];
  if (opts.logo) {
    gardeChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
        children: [
          new ImageRun({
            type: opts.logo.type,
            data: opts.logo.data,
            transformation: { width: 120, height: 120 },
            altText: { title: "Logo", description: "Victimes & Préjudices", name: "logo" },
          }),
        ],
      }),
    );
  }
  gardeChildren.push(
    heading1Center("Réclamation chiffrée", { before: 400, after: 200 }),
    paragraphCenter(`Dossier : ${dossier.reference}`, { after: 100, bold: true }),
    paragraphCenter(`Fait générateur : ${labelFaitGenerateur(dossier.faitGenerateur)}`),
    paragraphCenter(""),
    paragraphCenter(`Date de l'accident : ${formatDateFR(dossier.dateAccident)}`),
    paragraphCenter(`Date de consolidation : ${formatDateFR(dossier.dateConsolidation)}`),
    paragraphCenter(`Date de liquidation : ${formatDateFR(dossier.dateLiquidation)}`),
    paragraphCenter(""),
    paragraphCenter(`Document édité le ${formatDateFR(dateEdition)}`, { italic: true }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // --- Corps : une section par catégorie présente ---
  const bodyChildren: Array<Paragraph | Table> = [];
  for (const cat of categoriesRendues) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [new TextRun({ text: CATEGORIE_LABEL[cat] })],
      }),
    );
    const lignesCat = synthese.lignes.filter(
      (l) => l.categorie === cat && (l.montant !== 0 || l.tiersPayeur !== 0),
    );
    bodyChildren.push(buildLignesTable(lignesCat));
    // Encadrés de démonstration
    for (const l of lignesCat) {
      if (
        CAPITALISABLES.has(l.code) &&
        (l.echus || l.aEchoir) &&
        l.montant !== 0
      ) {
        bodyChildren.push(buildDemonstration(l, dossier));
        demonstrationCodes.push(l.code);
      }
    }
    // Sous-total catégorie
    const s = synthese.sousTotaux.find((x) => x.categorie === cat);
    if (s) bodyChildren.push(buildSousTotalTable(s.label, s));
  }

  // --- Recours des tiers payeurs par organisme (si ventilation existe) ---
  if (synthese.recoursTP.parOrganisme.length > 0 && synthese.recoursTP.totalGeneral.total > 0) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [new TextRun({ text: "Recours des tiers payeurs" })],
      }),
      buildRecoursTable(synthese),
    );
  }

  // --- Récapitulatif final ---
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text: "Récapitulatif" })],
    }),
    buildRecapitulatifTable(synthese, dossier),
  );

  // --- Pied de document : mentions ---
  bodyChildren.push(
    new Paragraph({
      spacing: { before: 400, after: 100 },
      border: { top: { color: "auto", size: 4, style: BorderStyle.SINGLE, space: 6 } },
      children: [
        new TextRun({
          text:
            `Capitalisation : barème Gazette du Palais 2025, taux 0,5 %, table ${TABLE_LABEL[dossier.tableMortalite]}. ` +
            `Valeur du point AIPP : ${AIPP_META.nom}, édition ${AIPP_META.edition ?? "non renseignée"}. ` +
            `Fourchettes indicatives : ${REFERENTIEL.nom}, édition ${REFERENTIEL.edition ?? "non renseignée"}. ` +
            `Chiffrage établi le ${formatDateFR(dateEdition)}. ` +
            `Document de travail établi sous réserve de l'évolution du dossier.`,
          italics: true,
          size: 20,
        }),
      ],
    }),
  );

  // --- Points de vigilance (avertissements) ---
  const aPointsDeVigilance = synthese.avertissements.length > 0;
  if (aPointsDeVigilance) {
    bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "Points de vigilance" })],
      }),
    );
    for (const a of synthese.avertissements) {
      bodyChildren.push(
        new Paragraph({
          spacing: { after: 80 },
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: `${a.poste} : `, bold: true }),
            new TextRun({ text: a.message }),
          ],
        }),
      );
    }
  }

  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 2 cm
      },
      titlePage: true, // page de garde sans en-tête ni pied
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Réclamation chiffrée — ${dossier.reference}`,
                size: 18,
                italics: true,
              }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
              new TextRun({ text: " sur ", size: 18 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
            ],
          }),
        ],
      }),
    },
    children: [...gardeChildren, ...bodyChildren],
  };

  const document = new Document({
    creator: "Victimes & Préjudices",
    title: `Réclamation chiffrée — ${dossier.reference}`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } }, // 11 pt
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 32, bold: true },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 26, bold: true },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [section],
  });

  void children;
  void tables;

  return {
    document,
    nbSections: categoriesRendues.length + 1 /* récap */ + (aPointsDeVigilance ? 1 : 0),
    categoriesRendues,
    aPointsDeVigilance,
    demonstrationCodes,
  };
}

// ============================================================
// Blocs
// ============================================================

const BORDER_THIN = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "888888",
};
const CELL_BORDERS = {
  top: BORDER_THIN,
  bottom: BORDER_THIN,
  left: BORDER_THIN,
  right: BORDER_THIN,
};

const CONTENT_WIDTH_DXA = 11906 - 1134 * 2; // ≈ 9638

function heading1Center(text: string, spacing?: IParagraphOptions["spacing"]): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing,
    children: [new TextRun({ text })],
  });
}

function paragraphCenter(
  text: string,
  fmt: { bold?: boolean; italic?: boolean; after?: number } = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: fmt.after ?? 80 },
    children: [new TextRun({ text, bold: fmt.bold, italics: fmt.italic })],
  });
}

function labelFaitGenerateur(fg: string): string {
  return fg.replace(/_/g, " ");
}

function headerCell(text: string, widthDxa: number, align: AlignmentType = AlignmentType.LEFT): TableCell {
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { fill: "EEEEEE", type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold: true, size: 20 })],
      }),
    ],
  });
}

function textCell(
  text: string,
  widthDxa: number,
  align: AlignmentType = AlignmentType.LEFT,
  bold = false,
): TableCell {
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: widthDxa, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, size: 20 })],
      }),
    ],
  });
}

function buildLignesTable(lignes: LigneSynthese[]): Table {
  // 5 colonnes de montants + libellé
  const wLib = Math.round(CONTENT_WIDTH_DXA * 0.32);
  const wCol = Math.round((CONTENT_WIDTH_DXA - wLib) / 5);
  const cols = [wLib, wCol, wCol, wCol, wCol, CONTENT_WIDTH_DXA - wLib - wCol * 4];
  const headerRow = new TableRow({
    tableHeader: true, // répétition d'en-tête sur saut de page
    children: [
      headerCell("Poste", cols[0]),
      headerCell("Montant", cols[1], AlignmentType.RIGHT),
      headerCell("Créance TP", cols[2], AlignmentType.RIGHT),
      headerCell("Dette", cols[3], AlignmentType.RIGHT),
      headerCell("Part victime", cols[4], AlignmentType.RIGHT),
      headerCell("Part TP", cols[5], AlignmentType.RIGHT),
    ],
  });
  const rows = [headerRow];
  for (const l of lignes) {
    rows.push(
      new TableRow({
        cantSplit: true, // pas de coupure au milieu d'un poste
        children: [
          textCell(`${l.code} — ${l.poste}`, cols[0]),
          textCell(formatEurosDocx(l.montant), cols[1], AlignmentType.RIGHT),
          textCell(formatEurosDocx(l.tiersPayeur), cols[2], AlignmentType.RIGHT),
          textCell(formatEurosDocx(l.dette), cols[3], AlignmentType.RIGHT),
          textCell(formatEurosDocx(l.partVictime), cols[4], AlignmentType.RIGHT),
          textCell(formatEurosDocx(l.partTP), cols[5], AlignmentType.RIGHT),
        ],
      }),
    );
  }
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: cols,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function buildDemonstration(l: LigneSynthese, dossier: DossierData): Table {
  const lines: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `Démonstration — ${l.code} ${l.poste}`, bold: true, size: 20 }),
      ],
    }),
  ];
  if (l.aEchoir) {
    lines.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `Capital à échoir (rente × PER) : ${formatEurosDocx(l.aEchoir.montant)}`,
            size: 20,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `Barème : Gazette du Palais 2025 (taux 0,5 %), table ${TABLE_LABEL[dossier.tableMortalite]}.`,
            size: 20,
            italics: true,
          }),
        ],
      }),
    );
  }
  if (l.echus && l.echus.montant > 0) {
    lines.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `Arrérages échus (consolidation → liquidation) : ${formatEurosDocx(l.echus.montant)} (dont TP : ${formatEurosDocx(l.echus.tp)}).`,
            size: 20,
          }),
        ],
      }),
    );
  }
  const cell = new TableCell({
    borders: CELL_BORDERS,
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: lines,
  });
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH_DXA],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ cantSplit: true, children: [cell] })],
  });
}

function buildSousTotalTable(label: string, s: { montant: number; tiersPayeur: number; dette: number; partVictime: number; partTP: number }): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    children: [
      new TextRun({
        text: `Sous-total ${label} — Montant : ${formatEurosDocx(s.montant)} | Part victime : ${formatEurosDocx(s.partVictime)} | Part TP : ${formatEurosDocx(s.partTP)}`,
        bold: true,
        size: 20,
      }),
    ],
  });
}

function buildRecoursTable(synthese: Synthese): Table {
  const wLib = Math.round(CONTENT_WIDTH_DXA * 0.4);
  const wCol = Math.round((CONTENT_WIDTH_DXA - wLib) / 3);
  const cols = [wLib, wCol, wCol, CONTENT_WIDTH_DXA - wLib - wCol * 2];
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Organisme", cols[0]),
        headerCell("Échu", cols[1], AlignmentType.RIGHT),
        headerCell("À échoir", cols[2], AlignmentType.RIGHT),
        headerCell("Total", cols[3], AlignmentType.RIGHT),
      ],
    }),
    ...synthese.recoursTP.parOrganisme.map(
      (o) =>
        new TableRow({
          cantSplit: true,
          children: [
            textCell(o.organisme.nom, cols[0]),
            textCell(formatEurosDocx(o.totaux.echu), cols[1], AlignmentType.RIGHT),
            textCell(formatEurosDocx(o.totaux.aEchoir), cols[2], AlignmentType.RIGHT),
            textCell(formatEurosDocx(o.totaux.total), cols[3], AlignmentType.RIGHT),
          ],
        }),
    ),
    new TableRow({
      cantSplit: true,
      children: [
        textCell("Total général", cols[0], AlignmentType.LEFT, true),
        textCell(
          formatEurosDocx(synthese.recoursTP.totalGeneral.echu),
          cols[1],
          AlignmentType.RIGHT,
          true,
        ),
        textCell(
          formatEurosDocx(synthese.recoursTP.totalGeneral.aEchoir),
          cols[2],
          AlignmentType.RIGHT,
          true,
        ),
        textCell(
          formatEurosDocx(synthese.recoursTP.totalGeneral.total),
          cols[3],
          AlignmentType.RIGHT,
          true,
        ),
      ],
    }),
  ];
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: cols,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function buildRecapitulatifTable(synthese: Synthese, dossier: DossierData): Table {
  const wLib = Math.round(CONTENT_WIDTH_DXA * 0.65);
  const wVal = CONTENT_WIDTH_DXA - wLib;
  const rows: TableRow[] = [];
  for (const s of synthese.sousTotaux) {
    if (s.montant === 0) continue;
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          textCell(`Sous-total — ${s.label}`, wLib),
          textCell(formatEurosDocx(s.montant), wVal, AlignmentType.RIGHT),
        ],
      }),
    );
  }
  rows.push(
    new TableRow({
      cantSplit: true,
      children: [
        textCell("Total général des postes", wLib, AlignmentType.LEFT, true),
        textCell(formatEurosDocx(synthese.totalMontant), wVal, AlignmentType.RIGHT, true),
      ],
    }),
    new TableRow({
      cantSplit: true,
      children: [
        textCell("Dette du responsable", wLib),
        textCell(formatEurosDocx(synthese.totalDette), wVal, AlignmentType.RIGHT),
      ],
    }),
    new TableRow({
      cantSplit: true,
      children: [
        textCell("Part revenant à la victime (droit de préférence)", wLib, AlignmentType.LEFT, true),
        textCell(formatEurosDocx(synthese.totalVictime), wVal, AlignmentType.RIGHT, true),
      ],
    }),
  );
  for (const p of dossier.provisions || []) {
    if (!isFinite(p.montant) || p.montant <= 0) continue;
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          textCell(
            `Provision${p.date ? ` du ${formatDateFR(p.date)}` : ""}${p.libelle ? ` — ${p.libelle}` : ""}`,
            wLib,
          ),
          textCell(`− ${formatEurosDocx(p.montant)}`, wVal, AlignmentType.RIGHT),
        ],
      }),
    );
  }
  rows.push(
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          borders: CELL_BORDERS,
          width: { size: wLib, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          shading: { fill: "F0F0F0", type: ShadingType.CLEAR, color: "auto" },
          children: [
            new Paragraph({ children: [new TextRun({ text: "Solde revenant à la victime", bold: true, size: 24 })] }),
          ],
        }),
        new TableCell({
          borders: CELL_BORDERS,
          width: { size: wVal, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          shading: { fill: "F0F0F0", type: ShadingType.CLEAR, color: "auto" },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: formatEurosDocx(synthese.soldeVictime), bold: true, size: 24 })],
            }),
          ],
        }),
      ],
    }),
  );
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [wLib, wVal],
    layout: TableLayoutType.FIXED,
    rows,
  });
}

// ============================================================
// Helpers exposés pour l'appelant
// ============================================================

/** Charge un asset image (PNG) en Uint8Array. */
export async function loadLogoAsset(url: string): Promise<{ data: Uint8Array; type: "png" }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossible de charger le logo (${res.status})`);
  const buf = await res.arrayBuffer();
  return { data: new Uint8Array(buf), type: "png" };
}

/** Sérialise le document et déclenche un téléchargement. Uniquement en navigateur. */
export async function downloadDocx(
  document: Document,
  filename: string,
): Promise<void> {
  const blob = await Packer.toBlob(document);
  saveAs(blob, filename);
}

/** Construit un nom de fichier "reclamation-{ref}-{AAAA-MM-JJ}.docx". */
export function buildFilename(reference: string, isoDate?: string): string {
  const d = (isoDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const ref = (reference || "dossier").trim().replace(/[^A-Za-z0-9À-ÿ_-]+/g, "_");
  return `reclamation-${ref}-${d}.docx`;
}
