import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./Footer";

// Footer now reads the locale layer (useStrings → useRouter); on an English
// route it renders the English dictionary, which these assertions target.
let pathname = "/";
vi.mock("next/router", () => ({ useRouter: () => ({ pathname }) }));

describe("Footer", () => {
  it("links to all four legal pages", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /about/i })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /contact/i })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute("href", "/terms");
  });

  it("links a French route to the French legal pages and marks the current one", () => {
    pathname = "/fr/privacy";
    try {
      render(<Footer />);
      expect(screen.getByRole("link", { name: /à propos/i })).toHaveAttribute("href", "/fr/about");
      const privacy = screen.getByRole("link", { name: /confidentialité/i });
      expect(privacy).toHaveAttribute("href", "/fr/privacy");
      expect(privacy).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: /contact/i })).toHaveAttribute("href", "/fr/contact");
      expect(screen.getByRole("link", { name: /conditions/i })).toHaveAttribute("href", "/fr/terms");
    } finally {
      pathname = "/";
    }
  });

  it("shows a Pokémon non-affiliation disclaimer", () => {
    render(<Footer />);
    expect(screen.getByText(/not affiliated with/i)).toBeInTheDocument();
  });

  it("credits the IP owners instead of claiming a copyright for the site", () => {
    render(<Footer />);
    expect(screen.getByText("Pokémon © Nintendo / Creatures / GAME FREAK.")).toBeInTheDocument();
    expect(screen.queryByText(/© My Pok/)).not.toBeInTheDocument();
  });
});
