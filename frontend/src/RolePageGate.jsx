import { useEffect, useState } from "react";

const ROLE_LABELS = {
  admin: "Admin",
  case_manager: "Case Manager",
  parole_officer: "Parole Officer",
  provider: "Housing Provider",
};

export default function RolePageGate({ allowedRoles, children }) {
  const [status, setStatus] = useState("loading");
  const [currentRole, setCurrentRole] = useState("");

  useEffect(() => {
    let cancelled = false;

    const checkRole = async () => {
      try {
        const response = await fetch("/api/me/", {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setStatus("unauthenticated");
          }
          return;
        }

        const payload = await response.json();
        const role = payload?.role || "";

        if (cancelled) {
          return;
        }

        setCurrentRole(role);
        if (allowedRoles.includes(role)) {
          setStatus("authorized");
        } else {
          setStatus("forbidden");
        }
      } catch {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
      }
    };

    checkRole();

    return () => {
      cancelled = true;
    };
  }, [allowedRoles]);

  if (status === "loading") {
    return <p>Checking access...</p>;
  }

  if (status === "unauthenticated") {
    return (
      <section>
        <h1>Sign in required</h1>
        <p>Your session is not authenticated. Please sign in and try again.</p>
        <a href="/login.html">Go to Login</a>
      </section>
    );
  }

  if (status === "forbidden") {
    return (
      <section>
        <h1>Access denied</h1>
        <p>
          This page is restricted. Your current role is {ROLE_LABELS[currentRole] || currentRole || "Unknown"}.
        </p>
      </section>
    );
  }

  return children;
}
