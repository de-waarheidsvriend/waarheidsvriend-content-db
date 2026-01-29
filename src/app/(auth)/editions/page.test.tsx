/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EditionsPage from "./page";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock fetch for the editions API
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Editions page", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders the page title", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    render(<EditionsPage />, { wrapper: createWrapper() });

    expect(
      screen.getByRole("heading", { name: "Edities", level: 1 })
    ).toBeInTheDocument();
  });

  it("renders the upload button", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    render(<EditionsPage />, { wrapper: createWrapper() });

    expect(
      screen.getByRole("link", { name: "Nieuwe editie uploaden" })
    ).toBeInTheDocument();
  });

  it("shows loading skeletons while fetching", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<EditionsPage />, { wrapper: createWrapper() });

    // Skeleton elements should be present
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no editions", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    render(<EditionsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Geen edities")).toBeInTheDocument();
    expect(
      screen.getByText(/Er zijn nog geen edities verwerkt/i)
    ).toBeInTheDocument();
  });

  it("renders edition cards when editions exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [
            {
              id: 1,
              editionNumber: 2024001,
              editionDate: "2024-01-15T00:00:00.000Z",
              status: "completed",
              articleCount: 12,
              createdAt: "2024-01-15T10:00:00.000Z",
            },
            {
              id: 2,
              editionNumber: 2024002,
              editionDate: "2024-01-22T00:00:00.000Z",
              status: "processing",
              articleCount: 8,
              createdAt: "2024-01-22T10:00:00.000Z",
            },
          ],
        }),
    });

    render(<EditionsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Editie 2024001")).toBeInTheDocument();
    expect(screen.getByText("Editie 2024002")).toBeInTheDocument();
    expect(screen.getByText("12 artikelen")).toBeInTheDocument();
    expect(screen.getByText("8 artikelen")).toBeInTheDocument();
    expect(screen.getByText("Voltooid")).toBeInTheDocument();
    expect(screen.getByText("Verwerken...")).toBeInTheDocument();
  });
});
