/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplitView } from './SplitView';

// Mock child components
vi.mock('./PdfSpreadView', () => ({
  PdfSpreadView: ({ editionId, pageStart, pageEnd }: { editionId: number; pageStart: number | null; pageEnd: number | null }) => (
    <div data-testid="pdf-spread-view">
      PdfSpreadView: edition={editionId}, pages={pageStart ?? 'null'}-{pageEnd ?? 'null'}
    </div>
  ),
}));

vi.mock('./ArticleView', () => ({
  ArticleView: ({ articleId }: { articleId: number }) => (
    <div data-testid="article-view">ArticleView: article={articleId}</div>
  ),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  function TestQueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  TestQueryWrapper.displayName = 'TestQueryWrapper';
  return TestQueryWrapper;
}

describe('SplitView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render split view with PDF and article panels', () => {
    render(
      <SplitView editionId={1} articleId={10} pageStart={2} pageEnd={3} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Originele PDF')).toBeInTheDocument();
    expect(screen.getByText('Geparsede content')).toBeInTheDocument();
  });

  it('should pass correct props to PdfSpreadView', () => {
    render(
      <SplitView editionId={1} articleId={10} pageStart={2} pageEnd={3} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('pdf-spread-view')).toHaveTextContent('edition=1');
    expect(screen.getByTestId('pdf-spread-view')).toHaveTextContent('pages=2-3');
  });

  it('should pass correct props to ArticleView', () => {
    render(
      <SplitView editionId={1} articleId={10} pageStart={2} pageEnd={3} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('article-view')).toHaveTextContent('article=10');
  });

  it('should handle null page values', () => {
    render(
      <SplitView editionId={1} articleId={10} pageStart={null} pageEnd={null} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('pdf-spread-view')).toHaveTextContent('pages=null-null');
  });

  it('should render with single page (pageStart equals pageEnd)', () => {
    render(
      <SplitView editionId={1} articleId={10} pageStart={5} pageEnd={5} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('pdf-spread-view')).toHaveTextContent('pages=5-5');
  });

  it('should render with large page range', () => {
    render(
      <SplitView editionId={1} articleId={10} pageStart={1} pageEnd={24} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('pdf-spread-view')).toHaveTextContent('pages=1-24');
  });

  it('should have correct layout structure', () => {
    render(
      <SplitView editionId={1} articleId={10} pageStart={2} pageEnd={3} />,
      { wrapper: createWrapper() }
    );

    // Check that both panels exist
    const pdfPanel = screen.getByTestId('pdf-spread-view').parentElement?.parentElement;
    const articlePanel = screen.getByTestId('article-view').parentElement;

    expect(pdfPanel).toBeInTheDocument();
    expect(articlePanel).toBeInTheDocument();
  });
});
