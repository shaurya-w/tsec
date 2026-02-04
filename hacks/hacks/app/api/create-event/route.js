import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function POST(req) {
  try {
    const { name, groupId, selectedUserIds, categories } = await req.json()

    const newEvent = await prisma.event.create({
      data: {
        name: name,
        groupId: groupId,

        // 1. Add everyone to the main Event Participant list
        participants: {
          create: selectedUserIds.map((userId) => ({
            userId: userId,
            role: "PARTICIPANT"
          })),
        },

        // 2. Create Baskets AND Add Members simultaneously
        categories: {
          create: categories.map((cat) => ({
            name: cat.name,
            
            // Ensure Decimal compatibility
            spendingLimit: cat.spendingLimit, 
            
            ruleType: "EQUAL_SPLIT",

            // ✅ CRITICAL FIX: Create CategoryMember entries here
            members: {
                create: (cat.memberIds || []).map((memberId) => ({
                    userId: memberId
                }))
            }
          })),
        },
      },
      include: {
        participants: true,
        categories: {
            include: {
                members: true // Return members so UI updates instantly
            }
        }, 
      },
    })

    return NextResponse.json(newEvent, { status: 201 })
  } catch (error) {
    console.error("Create Event Error:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}