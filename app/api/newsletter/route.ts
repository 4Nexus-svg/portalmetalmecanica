import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }
  const supabase = await createServiceClient();
  await (supabase.from("subscribers") as any).upsert({ email }, { onConflict: "email" });
  return NextResponse.json({ success: true });
}
