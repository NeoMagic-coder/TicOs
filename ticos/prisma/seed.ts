import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-firma" },
    update: {},
    create: {
      name: "Demo Firma",
      slug: "demo-firma",
      plan: "PRO",
      users: {
        create: {
          email: "admin@ticos.com",
          name: "Admin User",
          role: "ADMIN",
        },
      },
    },
    include: { users: true },
  });

  const product = await prisma.product.create({
    data: {
      name: "Örnek Ürün",
      sku: "URUN-001",
      price: 199.99,
      stock: 100,
      category: "Elektronik",
      tenantId: tenant.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      firstName: "Ahmet",
      lastName: "Yılmaz",
      email: "ahmet@example.com",
      phone: "05551234567",
      city: "İstanbul",
      tenantId: tenant.id,
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "TIC-240611-0001",
      status: "PENDING",
      customerId: customer.id,
      totalAmount: 199.99,
      platform: "MANUAL",
      paymentMethod: "Kredi Kartı",
      tenantId: tenant.id,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          unitPrice: 199.99,
          totalPrice: 199.99,
        },
      },
    },
  });

  console.log("Seed verileri başarıyla eklendi:");
  console.log(`  Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`  Admin: admin@ticos.com`);
  console.log(`  Ürün: ${product.name}`);
  console.log(`  Müşteri: ${customer.firstName} ${customer.lastName}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
