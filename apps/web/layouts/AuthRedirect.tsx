import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import useInitialData from "@/hooks/useInitialData";
import useTheme from "@/hooks/useTheme";
import { useUser } from "@linkwarden/router/user";
import { useConfig } from "@linkwarden/router/config";

interface Props {
  children: ReactNode;
}

export default function AuthRedirect({ children }: Props) {
  const router = useRouter();
  const { status } = useSession();
  const [shouldRenderChildren, setShouldRenderChildren] = useState(false);
  const { data: user } = useUser();
  const { data: config } = useConfig();
  const openingPersonalWorkspace = useRef(false);
  const [personalError, setPersonalError] = useState(false);
  const [personalRetry, setPersonalRetry] = useState(0);

  const STRIPE_ENABLED = Boolean(config?.STRIPE_ENABLED);
  const TRIAL_PERIOD_DAYS = config?.TRIAL_PERIOD_DAYS || 14;
  const REQUIRE_CC = Boolean(config?.REQUIRE_CC);

  useInitialData();
  useTheme();

  useEffect(() => {
    if (!config || !router.isReady) return;
    const isLoggedIn = status === "authenticated";
    const isUnauthenticated = status === "unauthenticated";
    const isPublicPage = router.pathname.startsWith("/public");

    if (config.PERSONAL_MODE && !isPublicPage) {
      if (status === "loading") return;
      if (isUnauthenticated) {
        setShouldRenderChildren(false);
        if (!openingPersonalWorkspace.current) {
          openingPersonalWorkspace.current = true;
          signIn("credentials", { redirect: false })
            .then((response) => {
              if (!response?.ok) setPersonalError(true);
            })
            .catch(() => setPersonalError(true));
        }
        return;
      }
      openingPersonalWorkspace.current = false;
      const accountRoutes = [
        "/",
        "/login",
        "/register",
        "/confirmation",
        "/forgot",
        "/subscribe",
        "/settings/billing",
        "/settings/password",
        "/member-onboarding",
      ];
      if (
        accountRoutes.includes(router.pathname) ||
        router.pathname.startsWith("/auth/")
      ) {
        router.replace("/dashboard");
      } else {
        setShouldRenderChildren(true);
      }
      return;
    }

    const trialEndTime =
      new Date(user?.createdAt || 0).getTime() +
      (1 + Number(TRIAL_PERIOD_DAYS)) * 86400000; // Add 1 to account for the current day

    const daysLeft = Math.floor((trialEndTime - Date.now()) / 86400000);

    const hasInactiveSubscription =
      user?.id &&
      !user?.subscription?.active &&
      !user.parentSubscription?.active &&
      STRIPE_ENABLED &&
      (REQUIRE_CC || daysLeft <= 0);

    // There are better ways of doing this... but this one works for now
    const routes = [
      { path: "/login", isProtected: false },
      { path: "/register", isProtected: false },
      { path: "/confirmation", isProtected: false },
      { path: "/forgot", isProtected: false },
      { path: "/auth/reset-password", isProtected: false },
      { path: "/", isProtected: false },
      { path: "/subscribe", isProtected: true },
      { path: "/dashboard", isProtected: true },
      { path: "/settings", isProtected: true },
      { path: "/profile", isProtected: true },
      { path: "/collections", isProtected: true },
      { path: "/links", isProtected: true },
      { path: "/tags", isProtected: true },
      { path: "/preserved", isProtected: true },
      { path: "/admin", isProtected: true },
      { path: "/search", isProtected: true },
    ];

    if (isPublicPage) {
      setShouldRenderChildren(true);
    } else {
      if (isLoggedIn && hasInactiveSubscription) {
        redirectTo("/subscribe");
      } else if (isLoggedIn && !user?.name && user?.parentSubscriptionId) {
        redirectTo("/member-onboarding");
      } else if (
        isLoggedIn &&
        !routes.some((e) => router.pathname.startsWith(e.path) && e.isProtected)
      ) {
        redirectTo("/dashboard");
      } else if (
        isUnauthenticated &&
        routes.some((e) => router.pathname.startsWith(e.path) && e.isProtected)
      ) {
        redirectTo("/login");
      } else {
        setShouldRenderChildren(true);
      }
    }
  }, [status, user, config, router.pathname, router.isReady, personalRetry]);

  function redirectTo(destination: string) {
    router.push(destination).then(() => setShouldRenderChildren(true));
  }

  if (!config) return null;

  if (
    config.PERSONAL_MODE &&
    !router.pathname.startsWith("/public") &&
    (status !== "authenticated" || !shouldRenderChildren)
  ) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100 text-base-content p-6">
        <p role="status" aria-live="polite">
          {personalError
            ? "Your workspace could not be opened. Please try again."
            : "Opening your workspace…"}
        </p>
        {personalError && (
          <button
            className="btn btn-primary"
            onClick={() => {
              openingPersonalWorkspace.current = false;
              setPersonalError(false);
              setPersonalRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        )}
      </main>
    );
  }

  if (status !== "loading" && shouldRenderChildren) {
    return <>{children}</>;
  } else {
    return <></>;
  }
}
