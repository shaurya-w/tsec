import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- 1. BASKET-SPECIFIC REFUND ALGORITHM ---
function calculateSettlement(event) {
  if (!event || !event.categories) return [];

  const userRefundMap = {};
  const userNames = {};

  // Iterate over every Basket
  event.categories.forEach(cat => {
    const remainingBalance = Number(cat.totalPooled);

    // If basket has money left
    if (remainingBalance > 0.01) {
      const members = cat.members || [];
      const memberCount = members.length;

      if (memberCount > 0) {
        // Split remaining balance among members of THIS basket
        const refundPerMember = remainingBalance / memberCount;

        members.forEach(m => {
          if (!userRefundMap[m.userId]) {
            userRefundMap[m.userId] = 0;
            const participant = event.participants.find(p => p.userId === m.userId);
            userNames[m.userId] = participant?.user?.name || "Unknown";
          }
          userRefundMap[m.userId] += refundPerMember;
        });
      }
    }
  });

  return Object.keys(userRefundMap).map(userId => ({
    userId: userId,
    userName: userNames[userId],
    contributed: 0, 
    balance: Number(userRefundMap[userId].toFixed(2)) // Total Refund Amount
  }));
}

// --- 2. GET: PREVIEW SETTLEMENT ---
export async function GET(req, { params }) {
  try {
    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        participants: { include: { user: true } },
        categories: { include: { members: true, transactions: true } }
      }
    });

    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const settlementPlan = calculateSettlement(event);
    return NextResponse.json({ settlementPlan });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const BASE = "https://api.fmm.finternetlab.io/api/v1";

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, amount, categoryId } = body; 

    // A. PAY VENDOR (Same as before)
    if (type === 'VENDOR') {
        if (!categoryId) return NextResponse.json({ error: "Category ID required" }, { status: 400 });

        await prisma.user.upsert({
            where: { id: "VENDOR" },
            update: {},
            create: { id: "VENDOR", email: "vendor@system.local", name: "External Vendor" }
        });

        await prisma.$transaction([
            prisma.transaction.create({
                data: {
                    amount: -parseFloat(amount),
                    status: "SUCCESS",
                    transactionRef: `VENDOR_PAY_${Date.now()}`,
                    userId: "VENDOR",
                    eventId: id,
                    categoryId: categoryId 
                }
            }),
            prisma.event.update({
                where: { id },
                data: { totalPooled: { decrement: parseFloat(amount) } }
            }),
            prisma.expenseCategory.update({
                where: { id: categoryId },
                data: { totalPooled: { decrement: parseFloat(amount) } }
            })
        ]);

        return NextResponse.json({ success: true, message: "Vendor Paid" });
    }

    // B. REFUND LOGIC (Now with PROOFS 🧾)
    if (type === 'REFUND') {
        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                participants: { include: { user: true } },
                categories: { include: { members: true, transactions: true } } 
            }
        });

        const plan = calculateSettlement(event);
        const refundsToProcess = plan.filter(p => p.balance > 0.01);

        if (refundsToProcess.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: "No funds left to refund" });
        }

        // 1. Process Refunds one by one to ensure Proof Generation works
        const refundResults = await Promise.all(refundsToProcess.map(async (r) => {
            let proofId = `REFUND_PENDING_${Date.now()}`; // Fallback

            try {
                // A. Create Refund Intent
                const intentRes = await fetch(`${BASE}/payment-intents`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": process.env.FINTERNET_API_KEY,
                    },
                    body: JSON.stringify({
                        amount: r.balance.toString(),
                        currency: "USDC",
                        type: "DELIVERY_VS_PAYMENT", // Using DVP to allow Proof generation
                        settlementMethod: "OFF_RAMP_MOCK", 
                        settlementDestination: `bank_account_${r.userId}`, 
                        description: `Refund for ${event.name}`,
                        metadata: { refundUser: r.userId }
                    })
                });
                
                const intentData = await intentRes.json();
                const intentId = intentData.id;

                if (intentId) {
                    // B. Poll for Escrow (Refund channel)
                    let escrow = null;
                    let attempts = 0;
                    while (!escrow && attempts < 5) {
                        const escrowRes = await fetch(`${BASE}/payment-intents/${intentId}/escrow`, {
                            headers: { "X-API-Key": process.env.FINTERNET_API_KEY },
                        });
                        if (escrowRes.ok) {
                            escrow = await escrowRes.json();
                            break;
                        }
                        await wait(1500);
                        attempts++;
                    }

                    // C. Generate Delivery Proof (The "Receipt")
                    if (escrow) {
                        const proofRes = await fetch(`${BASE}/payment-intents/${intentId}/escrow/delivery-proof`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-API-Key": process.env.FINTERNET_API_KEY,
                            },
                            body: JSON.stringify({
                                proofHash: "0xREFUND" + Math.random().toString(16).slice(2), 
                                proofURI: "https://cooper.network/refund-receipt/" + intentId,
                                submittedBy: escrow.data.buyerAddress, // The Refund "Buyer" (Pool)
                            }),
                        });
                        
                        const proofData = await proofRes.json();
                        if (proofData?.data?.id) {
                            proofId = proofData.data.id; // ✅ CAPTURED REAL PROOF ID
                        }
                    }
                }
            } catch (err) {
                console.error(`Refund error for ${r.userName}:`, err);
            }

            // Return data for DB insertion
            return {
                amount: -r.balance, 
                status: "REFUNDED",
                transactionRef: proofId, // Storing the Proof ID!
                userId: r.userId,
                eventId: id,
            };
        }));

        // 2. Atomic Update: Insert Logs & Zero Totals
        await prisma.$transaction([
            // Bulk Create Refund Logs
            prisma.transaction.createMany({
                data: refundResults
            }),
            // Zero out Global Total
            prisma.event.update({
                where: { id },
                data: { totalPooled: 0 }
            }),
            // Zero out ALL Basket Totals
            prisma.expenseCategory.updateMany({
                where: { eventId: id },
                data: { totalPooled: 0 }
            })
        ]);

        return NextResponse.json({ success: true, count: refundsToProcess.length });
    }

    return NextResponse.json({ error: "Invalid Action" }, { status: 400 });

  } catch (error) {
    console.error("Settlement POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

