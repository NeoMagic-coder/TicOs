import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orderSchema } from "@/lib/validations";
import { handleApiError, ApiError } from "@/lib/api-error";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new ApiError(401, "Oturum açmanız gerekiyor");
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    const where = {
      tenantId: session.user.tenantId,
      ...(status && { status }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      data: orders,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
    const data = orderSchema.parse(body);

    const products = await prisma.product.findMany({
      where: {
        id: { in: data.items.map((i) => i.productId) },
        tenantId: session.user.tenantId,
      },
    });

    if (products.length !== data.items.length) {
      throw new ApiError(400, "Bazı ürünler bulunamadı");
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: data.customerId,
        totalAmount: data.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        ),
        discountAmount: data.discountAmount,
        shippingAmount: data.shippingAmount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        tenantId: session.user.tenantId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
          })),
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
