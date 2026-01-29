/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PdfSpreadView } from './PdfSpreadView';

// Mock usePageImages hook
const mockPageImages = [
  { id: 1, pageNumber: 1, imageUrl: '/uploads/page-1.png' },
  { id: 2, pageNumber: 2, imageUrl: '/uploads/page-2.png' },
  { id: 3, pageNumber: 3, imageUrl: '/uploads/page-3.png' },
  { id: 4, pageNumber: 4, imageUrl: '/uploads/page-4.png' },
  { id: 5, pageNumber: 5, imageUrl: '/uploads/page-5.png' },
];

vi.mock('@/hooks/usePageImages', () => ({
  usePageImages: vi.fn(() => ({
    data: mockPageImages,
    isLoading: false,
    error: null,
  })),
}));

// Import after mocking
import { usePageImages } from '@/hooks/usePageImages';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('PdfSpreadView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePageImages).mockReturnValue({
      data: mockPageImages,
      isLoading: false,
      error: null,
      isError: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
    } as ReturnType<typeof usePageImages>);
  });

  it('should render page image for single page', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={1} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByAltText('Pagina 1')).toBeInTheDocument();
  });

  it('should render spread for pages 2-3', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={2} pageEnd={3} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByAltText('Pagina 2')).toBeInTheDocument();
    expect(screen.getByAltText('Pagina 3')).toBeInTheDocument();
  });

  it('should show loading skeleton when loading', () => {
    vi.mocked(usePageImages).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
      isPending: true,
      isSuccess: false,
      status: 'pending',
    } as ReturnType<typeof usePageImages>);

    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={1} />,
      { wrapper: createWrapper() }
    );

    // Skeleton should be present (via CSS class)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show error message when error occurs', () => {
    vi.mocked(usePageImages).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
      isError: true,
      isPending: false,
      isSuccess: false,
      status: 'error',
    } as ReturnType<typeof usePageImages>);

    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={1} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Kon PDF-pagina's niet laden/i)).toBeInTheDocument();
  });

  it('should show message when no page images available', () => {
    vi.mocked(usePageImages).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
    } as ReturnType<typeof usePageImages>);

    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={1} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Geen PDF-pagina's beschikbaar/i)).toBeInTheDocument();
  });

  it('should show message when pageStart is null', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={null} pageEnd={null} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Geen paginanummers bekend/i)).toBeInTheDocument();
  });

  it('should show navigation for multi-spread articles', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={5} />,
      { wrapper: createWrapper() }
    );

    // Should show navigation buttons
    expect(screen.getByRole('button', { name: /Vorige/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volgende/i })).toBeInTheDocument();
  });

  it('should navigate between spreads', async () => {
    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={5} />,
      { wrapper: createWrapper() }
    );

    // Initially on spread 1 (page 1)
    expect(screen.getByText(/p\. 1/i)).toBeInTheDocument();

    // Click next
    fireEvent.click(screen.getByRole('button', { name: /Volgende/i }));

    // Should show spread 2 (pages 2-3)
    await waitFor(() => {
      expect(screen.getByText(/p\. 2-3/i)).toBeInTheDocument();
    });
  });

  it('should disable prev button on first spread', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={5} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole('button', { name: /Vorige/i })).toBeDisabled();
  });

  it('should group pages correctly: page 1 alone, then 2-3, 4-5', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={5} />,
      { wrapper: createWrapper() }
    );

    // First spread is page 1 alone
    expect(screen.getByText(/\(1\/3\)/)).toBeInTheDocument(); // 3 spreads: [1], [2-3], [4-5]
  });

  it('should show page indicator for single spread', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={1} />,
      { wrapper: createWrapper() }
    );

    // Only one spread, no navigation buttons
    expect(screen.queryByRole('button', { name: /Vorige/i })).not.toBeInTheDocument();
    expect(screen.getByText(/p\. 1/i)).toBeInTheDocument();
  });

  it('should handle article spanning only even pages', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={2} pageEnd={2} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByAltText('Pagina 2')).toBeInTheDocument();
    expect(screen.getByText(/p\. 2/)).toBeInTheDocument();
  });

  it('should handle article spanning only odd pages > 1', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={3} pageEnd={3} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByAltText('Pagina 3')).toBeInTheDocument();
    expect(screen.getByText(/p\. 3/)).toBeInTheDocument();
  });

  it('should navigate to next spread and then back', async () => {
    render(
      <PdfSpreadView editionId={1} pageStart={1} pageEnd={5} />,
      { wrapper: createWrapper() }
    );

    // Click next twice
    fireEvent.click(screen.getByRole('button', { name: /Volgende/i }));
    await waitFor(() => {
      expect(screen.getByText(/p\. 2-3/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Volgende/i }));
    await waitFor(() => {
      expect(screen.getByText(/p\. 4-5/i)).toBeInTheDocument();
    });

    // Now next should be disabled
    expect(screen.getByRole('button', { name: /Volgende/i })).toBeDisabled();

    // Go back
    fireEvent.click(screen.getByRole('button', { name: /Vorige/i }));
    await waitFor(() => {
      expect(screen.getByText(/p\. 2-3/i)).toBeInTheDocument();
    });
  });

  it('should show message when pages are not found in images', () => {
    vi.mocked(usePageImages).mockReturnValue({
      data: mockPageImages, // pages 1-5
      isLoading: false,
      error: null,
      isError: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
    } as ReturnType<typeof usePageImages>);

    render(
      <PdfSpreadView editionId={1} pageStart={10} pageEnd={12} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Geen PDF-pagina's gevonden voor pagina 10-12/i)).toBeInTheDocument();
  });

  it('should handle single page not found', () => {
    render(
      <PdfSpreadView editionId={1} pageStart={99} pageEnd={99} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Geen PDF-pagina's gevonden voor pagina 99/i)).toBeInTheDocument();
  });
});
