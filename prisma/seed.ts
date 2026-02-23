import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const accounts = [
  { accountNumber: "1000", accountName: "Cash / Bank", accountType: "Asset" },
  { accountNumber: "1100", accountName: "Accounts Receivable", accountType: "Asset" },
  { accountNumber: "1200", accountName: "Prepaid Expenses", accountType: "Asset" },
  { accountNumber: "1500", accountName: "Equipment (Capital Assets)", accountType: "Asset" },
  { accountNumber: "2000", accountName: "Accounts Payable", accountType: "Liability" },
  { accountNumber: "2100", accountName: "GST Collected", accountType: "Liability" },
  { accountNumber: "2200", accountName: "GST Paid (ITC)", accountType: "Asset" },
  { accountNumber: "2300", accountName: "Corporate Tax Payable", accountType: "Liability" },
  { accountNumber: "3000", accountName: "Owner's Equity", accountType: "Equity" },
  { accountNumber: "4000", accountName: "Revenue", accountType: "Revenue" },
  { accountNumber: "5000", accountName: "Cost of Goods Sold", accountType: "Expense" },
  { accountNumber: "6000", accountName: "Office Supplies", accountType: "Expense" },
  { accountNumber: "6100", accountName: "Rent", accountType: "Expense" },
  { accountNumber: "6200", accountName: "Utilities", accountType: "Expense" },
  { accountNumber: "6300", accountName: "Insurance", accountType: "Expense" },
  { accountNumber: "6400", accountName: "Professional Fees", accountType: "Expense" },
  { accountNumber: "6500", accountName: "Marketing & Advertising", accountType: "Expense" },
  { accountNumber: "6600", accountName: "Travel", accountType: "Expense" },
  { accountNumber: "6700", accountName: "Meals & Entertainment", accountType: "Expense" },
  { accountNumber: "6800", accountName: "Repairs & Maintenance", accountType: "Expense" },
  { accountNumber: "6900", accountName: "Miscellaneous Expense", accountType: "Expense" },
  { accountNumber: "7000", accountName: "Depreciation / CCA", accountType: "Expense" },
];

async function main() {
  console.log("Seeding chart of accounts...");

  for (const account of accounts) {
    await prisma.chartOfAccounts.upsert({
      where: { accountNumber: account.accountNumber },
      update: {},
      create: account,
    });
  }

  console.log(`Seeded ${accounts.length} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
