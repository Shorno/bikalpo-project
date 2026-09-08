export type PosCatalogIdentity = {
  typeId: number;
  typeName: string;
  pack: string;
};

export type PosCatalogSelection = {
  typeId: number;
  pack: string | null;
} | null;

export function buildPosTypeTree(variants: PosCatalogIdentity[]) {
  const types = new Map<
    number,
    { id: number; name: string; packs: Set<string> }
  >();
  for (const variant of variants) {
    const type = types.get(variant.typeId) ?? {
      id: variant.typeId,
      name: variant.typeName,
      packs: new Set<string>(),
    };
    type.packs.add(variant.pack);
    types.set(type.id, type);
  }
  return [...types.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((type) => ({
      ...type,
      packs: [...type.packs].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    }));
}

export function matchesPosTypeSelection(
  variant: PosCatalogIdentity,
  selection: PosCatalogSelection,
) {
  return (
    selection === null ||
    (variant.typeId === selection.typeId &&
      (selection.pack === null || variant.pack === selection.pack))
  );
}
