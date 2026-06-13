import type { PrismaClient } from "../../generated/prisma/client";
import { findProductRecordById, listAdminProductRecords, listCategoryRecords, listHomeCategoryRecords } from "./repository";
import type { AdminProductSummary, CategorySummary, ProductDeliveryTypeValue, ProductSummary } from "./types";

function getAvailableStock(item: { deliveryType: string; stockMode: string; _count: { cards: number } }) {
  if (item.deliveryType !== "CARD_AUTO" || item.stockMode === "UNLIMITED") {
    return -1;
  }

  return item._count.cards;
}

export async function listHomeProducts(prisma: PrismaClient): Promise<ProductSummary[]> {
  const records = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      category: true,
      _count: {
        select: {
          cards: {
            where: { status: "UNUSED" },
          },
        },
      },
    },
    orderBy: [{ sort: "asc" }, { id: "desc" }],
    take: 12,
  });

  return records.map((item) => ({
    id: item.id,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    name: item.name,
    slug: item.slug,
    coverImage: item.coverImage,
    price: item.price,
    deliveryType: item.deliveryType as ProductDeliveryTypeValue,
    stockMode: item.stockMode as "FINITE" | "UNLIMITED",
    availableStock: getAvailableStock(item),
  }));
}

export async function listHomeCategories(prisma: PrismaClient): Promise<CategorySummary[]> {
  const records = await listHomeCategoryRecords(prisma);

  return records.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    sort: item.sort,
    status: item.status,
  }));
}

export async function listAdminCategories(prisma: PrismaClient): Promise<CategorySummary[]> {
  const records = await listCategoryRecords(prisma);

  return records.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    sort: item.sort,
    status: item.status,
  }));
}

export async function listAdminProducts(prisma: PrismaClient): Promise<AdminProductSummary[]> {
  const records = await listAdminProductRecords(prisma);

  return records.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    subtitle: item.subtitle,
    coverImage: item.coverImage,
    price: item.price,
    status: item.status,
    deliveryType: item.deliveryType as ProductDeliveryTypeValue,
    minBuy: item.minBuy,
    maxBuy: item.maxBuy,
    sort: item.sort,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
  }));
}

export async function getAdminProductDetail(prisma: PrismaClient, id: number) {
  const record = await findProductRecordById(prisma, id);
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    categoryId: record.categoryId,
    name: record.name,
    slug: record.slug,
    subtitle: record.subtitle,
    coverImage: record.coverImage,
    description: record.description,
    price: record.price,
    status: record.status,
    deliveryType: record.deliveryType as ProductDeliveryTypeValue,
    fixedDeliveryContent: record.fixedDeliveryContent,
    manualDeliveryHint: record.manualDeliveryHint,
    stockMode: record.stockMode as "FINITE" | "UNLIMITED",
    minBuy: record.minBuy,
    maxBuy: record.maxBuy,
    sort: record.sort,
    purchaseNote: record.purchaseNote,
  };
}

export async function getProductDetailBySlug(prisma: PrismaClient, slug: string) {
  const record = await prisma.product.findFirst({
    where: {
      slug,
      status: "ACTIVE",
    },
    include: {
      _count: {
        select: {
          cards: {
            where: { status: "UNUSED" },
          },
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    categoryId: record.categoryId,
    name: record.name,
    slug: record.slug,
    subtitle: record.subtitle,
    coverImage: record.coverImage,
    description: record.description,
    price: record.price,
    status: record.status,
    minBuy: record.minBuy,
    maxBuy: record.maxBuy,
    sort: record.sort,
    purchaseNote: record.purchaseNote,
    deliveryType: record.deliveryType as ProductDeliveryTypeValue,
    manualDeliveryHint: record.manualDeliveryHint,
    stockMode: record.stockMode as "FINITE" | "UNLIMITED",
    availableStock: getAvailableStock(record),
  };
}
