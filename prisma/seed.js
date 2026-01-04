const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // No mock data allowed.
    // Real data only.
    console.log("No seed data. App starts empty.");
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    });
