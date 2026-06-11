import { NextResponse } from "next/server";
import { decideGate } from "@/lib/auth-gate";
import { auth } from "@/lib/auth";

// Next 16 renamed Middleware -> Proxy (runs on the Node runtime). This does
// optimistic, cookie-only auth checks: it reads the JWT session, never the DB.
// The actual decision lives in the pure `decideGate` (unit-tested).
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth?.user ? { role: req.auth.user.role } : null;
  const decision = decideGate(pathname, session);

  switch (decision.kind) {
    case "allow":
      return NextResponse.next();

    case "unauthorized": {
      if (decision.api) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }

    case "forbidden": {
      if (decision.api) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }
});

export const config = {
  // Run on everything except static assets and the auth endpoints themselves.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
