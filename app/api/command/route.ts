// app/api/command/route.ts
// Command API — Web/UI conversations

import { NextRequest, NextResponse } from "next/server";
import { commandChannel } from "@/lib/channels/command/channel";
import { logger } from "@/lib/platform/events/logger.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const userId = searchParams.get('userId') || undefined;

    if (!q || q.length < 2) {
      return NextResponse.json({
        success: false,
        reply: 'Please enter a search term',
        results: [],
      });
    }

    logger.info(`🔍 Command query: ${q}`);

    const response = await commandChannel.process({
      message: q,
      userId,
      role: 'property_manager',
    });

    return NextResponse.json({
      success: response.success,
      reply: response.reply,
      cards: response.cards,
      status: response.status,
    });

  } catch (error) {
    logger.error('Command API error:', { error });
    return NextResponse.json(
      { success: false, reply: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
