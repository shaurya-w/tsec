import prisma from '../../../lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { name, groupId, selectedUserIds, categories } = await req.json()

    // Example expected categories format:
    // categories = [
    //   { name: "Food", spendingLimit: 500 },
    //   { name: "Travel", spendingLimit: 1000 },
    //   { name: "Entertainment", spendingLimit: 300 },
    // ]

    const newEvent = await prisma.event.create({
      data: {
        name: name,
        groupId: groupId,

        // Participants
        participants: {
          create: selectedUserIds.map((userId) => ({
            userId: userId,
            role: "PARTICIPANT"
          })),
        },

        // Categories (sub-events)
        categories: {
          create: categories.map((cat) => ({
            name: cat.name,
            spendingLimit: cat.spendingLimit ? parseFloat(cat.spendingLimit) : null,
            ruleType: cat.ruleType || "EQUAL_SPLIT",
          })),
        },
      },
      include: {
        participants: true,
        categories: true, // Include sub-events
      },
    })

    return NextResponse.json(newEvent, { status: 201 })
  } catch (error) {
    console.error("Request error", error)
    return NextResponse.json({ error: "Error creating event" }, { status: 500 })
  }
}
