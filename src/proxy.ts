import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/change-password", // Must be accessible to show the form
  "/invite", // Invited users (no session yet) set their password here
  "/forms", // Public HyperForms fill + embed pages
  "/test", // Keep test page accessible for development
];

// Routes that should always be accessible
const ALWAYS_PUBLIC = ["/", "/api"];

export async function proxy(request: NextRequest) {
  // Skip middleware for non-GET requests (server actions, API routes, etc.)
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Check if route is public
  const isPublicRoute = 
    PUBLIC_ROUTES.some(route => path.startsWith(route)) ||
    ALWAYS_PUBLIC.some(route => path === route || path.startsWith(route + "/"));

  // If not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // If logged in and trying to access login/signup, redirect to dashboard
  if (user && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check if user needs to change password (invited users with temp password)
  if (user && path !== "/change-password") {
    const { data: userData } = await supabase
      .from("users")
      .select("password_change_required")
      .eq("id", user.id)
      .single<{ password_change_required: boolean }>();

    if (userData?.password_change_required) {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
  }

  return response;
}

// Configure which routes the proxy applies to
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - Server action requests (Next.js uses POST with special headers)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
