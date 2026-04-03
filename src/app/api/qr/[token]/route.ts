import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/server/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const player = await db.player.findUnique({
    where: { qrToken: token },
    include: { guild: { select: { id: true, inviteCode: true } } },
  });

  if (!player) {
    return NextResponse.json({ error: "Invalid QR token" }, { status: 404 });
  }

  const loginUrl = `/player-login?invite=${encodeURIComponent(player.guild.inviteCode)}&name=${encodeURIComponent(player.name)}&guild=${player.guild.id}`;

  const pngBuffer = await QRCode.toBuffer(loginUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${player.name}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
