/**
 * Public-domain national flags (Wikimedia Commons originals) composed into the FX pair discs.
 * First-party files kept byte-for-byte in packages/identity/sources/ (retrieved 2026-09-30); codegen only
 * normalises them for rendering. Gaps and licence flags are named in each record, never papered over.
 */
import type { ArtSource } from "../types.ts";

export const FLAG_ART: readonly ArtSource[] = [
  {
    key: "flag-eu",
    owner: "Wikimedia Commons — Flag of Europe",
    provenance: "public-domain",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Europe.svg",
    licence:
      'File {{PD-self}}; the design is {{Euroflag}}: the Council of Europe holds copyright in the emblem and permission is "unlikely in a commercial context" next to a company\'s own marks (flagged). {{Insignia}} restrictions apply. https://commons.wikimedia.org/wiki/File:Flag_of_Europe.svg',
    retrieved: "2026-09-30",
    usage: "Used only inside Senryo's FX pair discs, cropped by a disc, never distorted.",
    variants: {
      symbol: {
        path: "packages/identity/sources/flag-eu/flag-eu.svg",
        url: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg",
        sha256: "c15c9ce1d754dec3d2ba61d5e9456888f85cad9014e3b9231933fe599f10494a",
        viewBox: "0 0 900 600",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "flag-us",
    owner: "Wikimedia Commons — Flag of the United States",
    provenance: "public-domain",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_the_United_States.svg",
    licence:
      "{{PD-flag}} and {{PD-USGov}} (17 U.S.C. 105). {{Insignia}} restrictions apply. https://commons.wikimedia.org/wiki/File:Flag_of_the_United_States.svg",
    retrieved: "2026-09-30",
    usage: "Used only inside Senryo's FX pair discs, cropped by a disc, never distorted.",
    variants: {
      symbol: {
        path: "packages/identity/sources/flag-us/flag-us.svg",
        url: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_the_United_States.svg",
        sha256: "48f0d3e4a7bf2d5c0c8d09cd975696acb2f3af601aaca80c537933ad9ec166ec",
        viewBox: "0 0 7410 3900",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "flag-gb",
    owner: "Wikimedia Commons — Flag of the United Kingdom (3:5)",
    provenance: "public-domain",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_the_United_Kingdom_(3-5).svg",
    licence:
      "{{PD-UKGov}} (expired Crown copyright) and {{PD-old-100-1923}}. {{Insignia}} restrictions apply. https://commons.wikimedia.org/wiki/File:Flag_of_the_United_Kingdom_(3-5).svg",
    retrieved: "2026-09-30",
    usage: "Used only inside Senryo's FX pair discs, cropped by a disc, never distorted.",
    variants: {
      symbol: {
        path: "packages/identity/sources/flag-gb/flag-gb.svg",
        url: "https://upload.wikimedia.org/wikipedia/commons/8/83/Flag_of_the_United_Kingdom_%283-5%29.svg",
        sha256: "b93bb15033d6c2219f290121d40c0a741765bd4b077ebcf5a5b0d917ff725a28",
        viewBox: "0 0 50 30",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "flag-jp",
    owner: "Wikimedia Commons — Flag of Japan",
    provenance: "public-domain",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Japan.svg",
    licence:
      "{{PD-JapanGov|type=flags}} and {{PD-shape}}. {{Insignia}} restrictions apply. https://commons.wikimedia.org/wiki/File:Flag_of_Japan.svg",
    retrieved: "2026-09-30",
    usage: "Used only inside Senryo's FX pair discs, cropped by a disc, never distorted.",
    variants: {
      symbol: {
        path: "packages/identity/sources/flag-jp/flag-jp.svg",
        url: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Flag_of_Japan.svg",
        sha256: "35e785339e19d1ec1987cb9c3d8e66fc97f29a287db0b0b590b8dfdd96d4766b",
        viewBox: "0 0 900 600",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "flag-ch",
    owner: "Wikimedia Commons — Flag of Switzerland",
    provenance: "public-domain",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Switzerland.svg",
    licence:
      "{{PD-Flag-Switzerland}} and {{PD-shape}}; Swiss law restricts commercial use of the cross (flagged). {{Insignia}} restrictions apply. https://commons.wikimedia.org/wiki/File:Flag_of_Switzerland.svg",
    retrieved: "2026-09-30",
    usage: "Used only inside Senryo's FX pair discs, cropped by a disc, never distorted.",
    variants: {
      symbol: {
        path: "packages/identity/sources/flag-ch/flag-ch.svg",
        url: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Flag_of_Switzerland.svg",
        sha256: "900a0befb655721c1b52b5ec2754f2f553f52b230443aaf016cc224e6a0707ce",
        viewBox: "0 0 32 32",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "flag-ca",
    owner: "Wikimedia Commons — Flag of Canada (Pantone)",
    provenance: "public-domain",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Canada_(Pantone).svg",
    licence:
      "{{PD-flag}}; also a {{Prohibited Mark}} under the Canadian Trademarks Act — business use goes through Canadian Heritage (flagged). {{Insignia}} restrictions apply. Commons marks Flag_of_Canada.svg superseded by this file. https://commons.wikimedia.org/wiki/File:Flag_of_Canada_(Pantone).svg",
    retrieved: "2026-09-30",
    usage: "Used only inside Senryo's FX pair discs, cropped by a disc, never distorted.",
    variants: {
      symbol: {
        path: "packages/identity/sources/flag-ca/flag-ca-pantone.svg",
        url: "https://upload.wikimedia.org/wikipedia/commons/d/d9/Flag_of_Canada_%28Pantone%29.svg",
        sha256: "afe6921891d516f037e8fb9920128f8bfd86ef2ffe1a6d1d4aa7e22a032434bc",
        viewBox: "0 0 9600 4800",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
];
