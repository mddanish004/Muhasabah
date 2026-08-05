import { db } from "@/lib/db";
import { hashPassphrase } from "@/lib/auth";

async function main() {
  const passphrase = process.env.ADMIN_INITIAL_PASSPHRASE;
  if (!passphrase) {
    throw new Error("ADMIN_INITIAL_PASSPHRASE is required");
  }

  const existing = await db.admin.findFirst();
  const passphraseHash = await hashPassphrase(passphrase);

  if (existing) {
    await db.admin.update({
      where: { id: existing.id },
      data: { passphraseHash },
    });
    console.log("Updated existing admin passphrase hash.");
    return;
  }

  await db.admin.create({
    data: {
      passphraseHash,
      timezone: "Asia/Kolkata",
      weekStartsOn: 1,
      overloadThreshold: 9,
    },
  });

  console.log("Created admin record.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
