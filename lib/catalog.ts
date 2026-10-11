import { listCategories } from "@/lib/arcade";

// Arcade print categories that suit a pet-and-owner shop, matched by name because
// category ids must come from categories/list rather than being hard-coded.
const CURATED = [
  { name: "Floor Pillows", audience: "pet", note: "A floor cushion they can claim as their bed" },
  { name: "Placemats", audience: "pet", note: "Goes under the food and water bowls" },
  { name: "Scarves", audience: "pet", note: "Fold and tie it as a bandana" },
  { name: "Ribbon Scarf", audience: "pet", note: "A slim tie for a collar or a gift" },
  { name: "Decorative Pillows", audience: "owner", note: "Their pattern on your sofa" },
  { name: "Tea Towels", audience: "owner", note: "Everyday kitchen linen" },
  { name: "Napkins", audience: "owner", note: "For dinners they will try to join" },
  { name: "Pocket Squares", audience: "owner", note: "A small nod, worn on you" },
] as const;

export type CatalogItem = {
  categoryId: string;
  name: string;
  imageUrl: string | null;
  audience: "pet" | "owner";
  note: string;
};

export async function getCatalog(): Promise<CatalogItem[]> {
  const categories = await listCategories();
  return CURATED.flatMap((item) => {
    const category = categories.find((c) => c.world === "print" && c.name === item.name);
    return category
      ? [{ categoryId: category.categoryId, name: category.name, imageUrl: category.imageUrl, audience: item.audience, note: item.note }]
      : [];
  });
}
