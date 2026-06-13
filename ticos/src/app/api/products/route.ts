import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productSchema } from "@/lib/validations";
import { handleApiError, ApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new ApiError(401, "Oturum açmanız gerekiyor");
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    const where = {
      tenantId: session.user.tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(category && { category }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new ApiError(401, "Oturum açmanız gerekiyor");
    }

    const body = await req.json();
    const data = productSchema.parse(body);

    const existing = await prisma.product.findUnique({
      where: { sku_tenantId: { sku: data.sku, tenantId: session.user.tenantId } },
    });

    if (existing) {
      throw new ApiError(409, "Bu SKU ile bir ürün zaten mevcut");
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        cost: data.cost ?? undefined,
        tenantId: session.user.tenantId,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
