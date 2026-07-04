"use client";

const WEIGHT_UNITS = new Set(["KG", "KGS", "KILOGRAM", "KILOGRAMS"]);
const PIECE_UNITS = new Set(["PC", "PCS", "PIECE", "PIECES"]);
const DIRECT_COUNT_UNITS = new Set(["CYLINDER", "UNIT", "PAIR"]);

function isLpgTypeContext(typeName?: string | null, family?: string | null) {
  return (
    String(family || "")
      .trim()
      .toLowerCase() === "lpg" ||
    String(typeName || "")
      .trim()
      .toLowerCase() === "lpg"
  );
}

export function normalizeStockUnit(unit?: string | null) {
  return String(unit || "")
    .trim()
    .toUpperCase();
}

export function formatStockDisplayUnit(unit?: string | null) {
  const normalized = normalizeStockUnit(unit);
  if (normalized === "PCS" || normalized === "PC" || normalized === "PIECES") {
    return "Pc";
  }
  if (normalized === "PAIR") {
    return "Pair";
  }
  if (normalized === "FIT") {
    return "Fit";
  }
  if (normalized === "YARD") {
    return "Yard";
  }
  if (normalized === "CYLINDER") {
    return "Cylinder";
  }
  if (normalized === "PACK") {
    return "Pack";
  }
  if (normalized === "CARTON") {
    return "Carton";
  }
  return normalized || "Unit";
}

export function isDirectCountUnit(unit?: string | null) {
  return DIRECT_COUNT_UNITS.has(normalizeStockUnit(unit));
}

export function parseStockUnitLabelMeasure(label?: string | null) {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) return null;

  const pieceMatch = normalizedLabel.match(
    /(\d+(?:\.\d+)?)\s*(pc|pcs|piece|pieces|pair|unit)\b/i,
  );
  if (pieceMatch) {
    const value = Number(pieceMatch[1]);
    if (value > 0) {
      return {
        quantityPerPack: value,
        quantityUnit:
          normalizeStockUnit(pieceMatch[2]) === "PAIR" ? "PAIR" : "PCS",
      };
    }
  }

  const weightMatch = normalizedLabel.match(
    /(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms)\b/i,
  );
  if (weightMatch) {
    const value = Number(weightMatch[1]);
    if (value > 0) {
      return {
        quantityPerPack: value,
        quantityUnit: "KG",
      };
    }
  }

  return null;
}

export function getStockMeasureInfo(input: {
  packType?: string | null;
  orderUnit?: string | null;
  unitLabel?: string | null;
  weightKg?: string | number | null;
  piecesPerUnit?: number | null;
  typeName?: string | null;
  family?: string | null;
}) {
  const normalizedUnit = normalizeStockUnit(input.orderUnit);
  const packType = String(input.packType || "").trim().toLowerCase();
  const weightKg = Number(input.weightKg || 0);
  const piecesPerUnit = Number(input.piecesPerUnit || 0);
  const parsedLabelMeasure = parseStockUnitLabelMeasure(input.unitLabel);
  const isLpgContext = isLpgTypeContext(input.typeName, input.family);

  if (packType === "loose") {
    if (PIECE_UNITS.has(normalizedUnit)) {
      return { quantityPerPack: 1, quantityUnit: "PCS", isLoose: true };
    }
    if (weightKg > 0 || WEIGHT_UNITS.has(normalizedUnit)) {
      return { quantityPerPack: 1, quantityUnit: "KG", isLoose: true };
    }
    if (parsedLabelMeasure && parsedLabelMeasure.quantityUnit !== "KG") {
      return {
        quantityPerPack: 1,
        quantityUnit: parsedLabelMeasure.quantityUnit,
        isLoose: true,
      };
    }
    return {
      quantityPerPack: 1,
      quantityUnit: normalizedUnit || "KG",
      isLoose: true,
    };
  }

  if (isLpgContext) {
    return {
      quantityPerPack: 1,
      quantityUnit: "CYLINDER",
      isLoose: false,
    };
  }

  if (WEIGHT_UNITS.has(normalizedUnit) && weightKg > 0) {
    return { quantityPerPack: weightKg, quantityUnit: "KG", isLoose: false };
  }

  if (piecesPerUnit > 0) {
    return {
      quantityPerPack: piecesPerUnit,
      quantityUnit: PIECE_UNITS.has(normalizedUnit)
        ? "PCS"
        : normalizedUnit || "UNIT",
      isLoose: false,
    };
  }

  if (isDirectCountUnit(normalizedUnit)) {
    return {
      quantityPerPack: 1,
      quantityUnit: normalizedUnit,
      isLoose: false,
    };
  }

  if (parsedLabelMeasure) {
    return {
      quantityPerPack: parsedLabelMeasure.quantityPerPack,
      quantityUnit: parsedLabelMeasure.quantityUnit,
      isLoose: false,
    };
  }

  return {
    quantityPerPack: 1,
    quantityUnit: normalizedUnit || "PACK",
    isLoose: false,
  };
}
