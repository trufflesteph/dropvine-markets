import { NextResponse } from "next/server";

import { createAdminSession, isValidAdminPassword } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password");

  if (typeof password !== "string" || !isValidAdminPassword(password)) {
    return NextResponse.redirect(new URL("/admin?error=invalid", request.url), 303);
  }

  await createAdminSession();
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
