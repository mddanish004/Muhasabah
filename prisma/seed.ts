import { db } from "@/lib/db";
import { hashPassphrase } from "@/lib/auth";

async function main() {
  const admin = await db.admin.findFirst();
  if (!admin) {
    await db.admin.create({
      data: {
        passphraseHash: await hashPassphrase(process.env.ADMIN_INITIAL_PASSPHRASE ?? "change-me-now"),
        timezone: "Asia/Kolkata",
        weekStartsOn: 1,
        overloadThreshold: 9,
      },
    });
  }

  const categories = await Promise.all(
    [
      { name: "Work", color: "#5B9EF0", icon: "briefcase", description: "Deep work and admin tasks" },
      { name: "Health", color: "#4ADE80", icon: "heart-pulse", description: "Exercise, sleep, recovery" },
      { name: "Learning", color: "#F5A623", icon: "book-open", description: "Reading and study" },
    ].map((category) =>
      db.category.upsert({
        where: { name: category.name },
        create: category,
        update: category,
      }),
    ),
  );

  await db.task.createMany({
    data: [
      {
        title: "Review roadmap",
        categoryId: categories[0].id,
        dueDate: new Date("2026-08-05T06:30:00.000Z"),
        completedAt: new Date("2026-08-05T08:00:00.000Z"),
        priority: "HIGH",
      },
      {
        title: "45 minute walk",
        categoryId: categories[1].id,
        dueDate: new Date("2026-08-05T06:30:00.000Z"),
        priority: "MEDIUM",
      },
      {
        title: "Read 20 pages",
        categoryId: categories[2].id,
        dueDate: new Date("2026-08-04T06:30:00.000Z"),
        completedAt: new Date("2026-08-04T15:30:00.000Z"),
        priority: "LOW",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded admin, categories, and sample tasks.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
