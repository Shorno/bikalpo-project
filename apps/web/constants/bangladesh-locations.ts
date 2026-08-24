export const bangladeshDistrictsByDivision = {
  Barishal: [
    "Barguna",
    "Barishal",
    "Bhola",
    "Jhalokati",
    "Patuakhali",
    "Pirojpur",
  ],
  Chattogram: [
    "Bandarban",
    "Brahmanbaria",
    "Chandpur",
    "Chattogram",
    "Cox's Bazar",
    "Cumilla",
    "Feni",
    "Khagrachhari",
    "Lakshmipur",
    "Noakhali",
    "Rangamati",
  ],
  Dhaka: [
    "Dhaka",
    "Faridpur",
    "Gazipur",
    "Gopalganj",
    "Kishoreganj",
    "Madaripur",
    "Manikganj",
    "Munshiganj",
    "Narayanganj",
    "Narsingdi",
    "Rajbari",
    "Shariatpur",
    "Tangail",
  ],
  Khulna: [
    "Bagerhat",
    "Chuadanga",
    "Jashore",
    "Jhenaidah",
    "Khulna",
    "Kushtia",
    "Magura",
    "Meherpur",
    "Narail",
    "Satkhira",
  ],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  Rajshahi: [
    "Bogura",
    "Chapainawabganj",
    "Joypurhat",
    "Naogaon",
    "Natore",
    "Pabna",
    "Rajshahi",
    "Sirajganj",
  ],
  Rangpur: [
    "Dinajpur",
    "Gaibandha",
    "Kurigram",
    "Lalmonirhat",
    "Nilphamari",
    "Panchagarh",
    "Rangpur",
    "Thakurgaon",
  ],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
} as const;

export type BangladeshDivision = keyof typeof bangladeshDistrictsByDivision;

export const bangladeshDivisions = Object.keys(
  bangladeshDistrictsByDivision,
) as BangladeshDivision[];

export function districtsForDivision(division: string): readonly string[] {
  if (!(division in bangladeshDistrictsByDivision)) return [];
  return bangladeshDistrictsByDivision[division as BangladeshDivision];
}

export function normalizeBangladeshDivision(value: string) {
  const normalized = value
    .trim()
    .replace(/\s+division$/i, "")
    .replace(/^barisal$/i, "Barishal")
    .replace(/^chittagong$/i, "Chattogram");
  return (
    bangladeshDivisions.find(
      (division) => division.toLowerCase() === normalized.toLowerCase(),
    ) ?? ""
  );
}

export function normalizeBangladeshDistrict(value: string, division: string) {
  const normalized = value
    .trim()
    .replace(/\s+district$/i, "")
    .replace(/^comilla$/i, "Cumilla")
    .replace(/^chittagong$/i, "Chattogram")
    .replace(/^jessore$/i, "Jashore")
    .replace(/^bogra$/i, "Bogura");
  return (
    districtsForDivision(division).find(
      (district) => district.toLowerCase() === normalized.toLowerCase(),
    ) ?? ""
  );
}
