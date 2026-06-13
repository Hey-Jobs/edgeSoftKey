import { getAdminProducts } from "../../../modules/catalog/service";
import type { PageContextServer } from "vike/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const { prisma, session } = pageContext as any;

  if (session?.user?.role !== "admin") {
    return { discountCodes: { items: [], total: 0 }, products: [] };
  }

  const PAGE_SIZE = 20;
  
  const [discountCodesResult, products] = await Promise.all([
    prisma.discountCode.findMany({
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: PAGE_SIZE,
    }),
    getAdminProducts(prisma),
  ]);

  const total = await prisma.discountCode.count();

  return { 
    discountCodes: { items: discountCodesResult, total },
    products: products.map(p => ({ id: p.id, name: p.name })),
  };
}
