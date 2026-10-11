import { listCategories } from "@/lib/arcade";

export type UseCase = "sleep" | "dine" | "out" | "home" | "keepsake";

// Arcade print categories that suit a pet-and-owner shop, matched by name because
// category ids must come from categories/list rather than being hard-coded.
// `useCase` places each one on a shelf in the Cubby.
const CURATED: { name: string; audience: "pet" | "owner"; useCase: UseCase; note: string }[] = [
  { name: "Floor Pillows", audience: "pet", useCase: "sleep", note: "A floor cushion they can claim as their bed" },
  { name: "Quilts", audience: "pet", useCase: "sleep", note: "For the sofa corner they nap in" },
  { name: "Duvets", audience: "owner", useCase: "sleep", note: "The bed they sleep on anyway" },
  { name: "Placemats", audience: "pet", useCase: "dine", note: "Goes under the food and water bowls" },
  { name: "Napkins", audience: "owner", useCase: "dine", note: "For dinners they will try to join" },
  { name: "Tea Towels", audience: "owner", useCase: "dine", note: "Everyday kitchen linen" },
  { name: "Scarves", audience: "pet", useCase: "out", note: "Fold and tie it as a bandana" },
  { name: "Ribbon Scarf", audience: "pet", useCase: "out", note: "A slim tie for a collar or a gift" },
  { name: "Decorative Pillows", audience: "owner", useCase: "home", note: "Their pattern on your sofa" },
  { name: "Curtains", audience: "owner", useCase: "home", note: "For the window they guard" },
  { name: "Drum Lampshades", audience: "owner", useCase: "home", note: "A warm glow in their pattern" },
  { name: "Pocket Squares", audience: "owner", useCase: "keepsake", note: "A small nod, worn on you" },
];

export type CatalogItem = {
  categoryId: string | null;
  name: string;
  imageUrl: string | null;
  audience: "pet" | "owner";
  useCase: UseCase;
  note: string;
};

/** The curated list without Arcade data, for showing shelves before Arcade is connected. */
export function curatedCatalog(): CatalogItem[] {
  return CURATED.map((item) => ({ ...item, categoryId: null, imageUrl: null }));
}

export async function getCatalog(): Promise<(CatalogItem & { categoryId: string })[]> {
  const categories = await listCategories();
  return CURATED.flatMap((item) => {
    const category = categories.find((c) => c.world === "print" && c.name === item.name);
    return category
      ? [{ ...item, categoryId: category.categoryId, name: category.name, imageUrl: category.imageUrl }]
      : [];
  });
}
