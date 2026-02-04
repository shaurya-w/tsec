import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "https://api.fmm.finternetlab.io/api/v1";

// Helper: Wait function for polling
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req, { params }) {
  try {
    const { id } = await params;

    // --- STEP 1: FETCH INTENT & METADATA ---
    const intentRes = await fetch(`${BASE}/payment-intents/${id}`, {
      headers: { "X-API-Key": process.env.FINTERNET_API_KEY },
    });
    
    if (!intentRes.ok) throw new Error(`Intent fetch failed: ${intentRes.status}`);
    const intent = await intentRes.json();
    
    // Robust Metadata Extraction
    const metadata = intent.metadata || intent.data?.metadata || {};
    const { userId, eventId } = metadata;
    
    if (!userId || !eventId) {
        return NextResponse.json({ error: "Missing metadata (User/Event ID)" }, { status: 400 });
    }

    // --- STEP 2: FETCH ESCROW (WITH RETRY) ---
    let escrow = null;
    let attempts = 0;
    
    while (!escrow && attempts < 5) {
        const escrowRes = await fetch(`${BASE}/payment-intents/${id}/escrow`, {
            headers: { "X-API-Key": process.env.FINTERNET_API_KEY },
        });

        if (escrowRes.ok) {
            escrow = await escrowRes.json();
            break;
        } else {
            console.log(`Escrow not ready yet (Attempt ${attempts + 1}). Retrying...`);
            await wait(2000); 
            attempts++;
        }
    }

    if (!escrow) throw new Error("Escrow fetch failed after multiple attempts.");

    // --- STEP 3: GENERATE PROOF ---
    const proofRes = await fetch(`${BASE}/payment-intents/${id}/escrow/delivery-proof`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.FINTERNET_API_KEY,
      },
      body: JSON.stringify({
        proofHash: "0x" + Math.random().toString(16).slice(2).repeat(4), 
        proofURI: "https://cooper.network/proof/" + id,
        submittedBy: escrow.data.buyerAddress,
      }),
    });

    if (!proofRes.ok) throw new Error(`Proof generation failed`);
    const proof = await proofRes.json();

    // --- STEP 4: PREPARE DB UPDATES ---
    const amountVal = parseFloat(escrow.data.amount);

    // A. Fetch Event Structure to determine basket splits
    const eventContext = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
            categories: {
                include: { members: true }
            }
        }
    });

    // B. Calculate updates for specific baskets
    // We assume the user paid their exact share. We distribute that share into the baskets they are part of.
    const basketUpdates = [];
    
    if (eventContext && eventContext.categories) {
        eventContext.categories.forEach((cat) => {
            // Is the paying user in this basket?
            const isMember = cat.members.some((m) => m.userId === userId);
            
            if (isMember) {
                // Calculate the share for this specific basket
                const count = cat.members.length || 1;
                const limit = Number(cat.spendingLimit || 0);
                const shareForThisBasket = limit / count;

                // Add update query to the list
                basketUpdates.push(
                    prisma.expenseCategory.update({
                        where: { id: cat.id },
                        data: {
                            totalPooled: { increment: shareForThisBasket }
                        }
                    })
                );
            }
        });
    }

    // --- STEP 5: ATOMIC TRANSACTION ---
    await prisma.$transaction([
        // 1. Create Audit Log
        prisma.transaction.create({
            data: {
                amount: amountVal,
                status: "SUCCESS",
                transactionRef: proof.data.id, 
                userId: userId,
                eventId: eventId,
            }
        }),

        // 2. Update Global Event Total
        prisma.event.update({
            where: { id: eventId },
            data: {
                totalPooled: { increment: amountVal }
            }
        }),

        // 3. Update Specific Baskets (Spread the array of promises)
        ...basketUpdates
    ]);

    return NextResponse.json({ escrow, proof, status: "Recorded & Distributed" });

  } catch (error) {
    console.error("Pipeline Error:", error);
    return NextResponse.json(
        { error: error.message || "Pipeline processing failed" }, 
        { status: 500 }
    );
  }
}