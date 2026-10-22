/** HS heading labels and the catalogue-to-heading mapping. Pure data, safe for server and browser. */

export const HEADING_LABELS: Record<string, string> = {
  "3916": "Plastic profile shapes, rods and sticks",
  "3917": "Plastic tubes, pipes, hoses and fittings",
  "3923": "Plastic packing articles, lids and caps",
  "3924": "Plastic tableware, kitchenware and household articles",
  "3925": "Plastic builders' ware",
  "3926": "Other plastic articles",
  "9403": "Other furniture (includes plastic furniture)",
};

/** Candidate HS headings per catalogue product. An inference for evidence lookup, not a classification. */
export const HEADINGS_FOR_ENTRY: Record<string, string[]> = {
  "food-storage-containers": ["3924", "3923"],
  "household-storage-boxes": ["3924", "3923"],
  "crates-and-baskets": ["3923"],
  "caps-and-closures": ["3923"],
  "planters-and-nursery": ["3924", "3926"],
  "buckets-and-cleaning-ware": ["3924"],
  "stackable-furniture": ["9403"],
  "hangers-and-laundry": ["3924", "3926"],
  "food-service-ware": ["3924"],
  "irrigation-drip": ["3917"],
  "conduits-and-ducts": ["3917"],
  "pipes-and-fittings": ["3917"],
  "extruded-profiles-and-trims": ["3916"],
  "industrial-pallets": ["3923", "3926"],
  "blow-moulded-bottles": ["3923"],
  "thermoformed-trays": ["3923", "3924"],
  "rotomoulded-tanks": ["3925"],
};

