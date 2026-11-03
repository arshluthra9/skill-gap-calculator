"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Frame({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const links = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "How It Works", href: "/how-it-works" },
    { name: "Assessment", href: "/assessment" },
    { name: "Results", href: "/results" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Careers", href: "/careers" },
    { name: "Courses", href: "/courses" },
    { name: "Learning Roadmap", href: "/roadmap" },
    { name: "Progress", href: "/progress" },
    { name: "Admin", href: "/admin" },
  ];

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "16px 5%",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--background)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 20,
              fontWeight: 800,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            SKILL GAP CALCULATOR
          </Link>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  textDecoration: "none",
                  color:
                    pathname === link.href
                      ? "var(--accent)"
                      : "inherit",
                  fontWeight:
                    pathname === link.href ? 700 : 500,
                  fontSize: 14,
                }}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="shell">
        {children}

        <footer className="footer">
          <div style={{ marginBottom: 10 }}>
            SKILL GAP CALCULATOR · Built for students finding their next step.
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Created with purpose by{" "}
            <span style={{ color: "var(--accent)" }}>
              Arshpreet Singh Luthra
            </span>
          </div>

          <small>
            Career matches are guidance, not guarantees of employment or
            validated psychometric results.
          </small>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
            © 2026 Skill Gap Calculator. All rights reserved.
          </div>
        </footer>
      </main>
    </>
  );
}
