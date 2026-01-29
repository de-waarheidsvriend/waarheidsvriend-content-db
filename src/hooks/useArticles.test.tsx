/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArticle, type ArticleDetail } from './useArticles';

const mockArticle: ArticleDetail = {
  id: 1,
  title: 'Test Article',
  chapeau: 'Test chapeau',
  content: '<p>Test content</p>',
  excerpt: 'Test excerpt',
  category: 'Test Category',
  pageStart: 2,
  pageEnd: 3,
  editionId: 1,
  editionNumber: 2024001,
  authors: [
    { id: 1, name: 'Jan Jansen', photoUrl: '/uploads/jan.jpg' },
  ],
  featuredImage: {
    id: 1,
    url: '/uploads/featured.jpg',
    caption: 'Featured image caption',
  },
  images: [
    { id: 1, url: '/uploads/featured.jpg', caption: 'Featured', isFeatured: true },
    { id: 2, url: '/uploads/other.jpg', caption: 'Other', isFeatured: false },
  ],
};

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

describe('useArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch article details for an article', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: mockArticle }),
    } as Response);

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockArticle);
    expect(global.fetch).toHaveBeenCalledWith('/api/articles/1');
  });

  it('should not fetch when articleId is null', () => {
    const { result } = renderHook(() => useArticle(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle API error', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Article not found' },
      }),
    } as Response);

    const { result } = renderHook(() => useArticle(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Article not found');
  });

  it('should handle network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should return loading state initially', () => {
    vi.mocked(global.fetch).mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle article without optional fields', async () => {
    const minimalArticle: ArticleDetail = {
      id: 1,
      title: 'Minimal Article',
      chapeau: null,
      content: '<p>Content</p>',
      excerpt: null,
      category: null,
      pageStart: null,
      pageEnd: null,
      editionId: 1,
      editionNumber: 2024001,
      authors: [],
      featuredImage: null,
      images: [],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: minimalArticle }),
    } as Response);

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(minimalArticle);
    expect(result.current.data?.chapeau).toBeNull();
    expect(result.current.data?.authors).toHaveLength(0);
    expect(result.current.data?.featuredImage).toBeNull();
  });

  it('should use correct query key with different article IDs', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: { ...mockArticle, id: 42 } }),
    } as Response);

    const { result } = renderHook(() => useArticle(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/articles/42');
  });

  it('should handle missing data in response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    } as Response);

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Failed to fetch article');
  });

  it('should handle article with multiple authors', async () => {
    const multiAuthorArticle: ArticleDetail = {
      ...mockArticle,
      authors: [
        { id: 1, name: 'Jan Jansen', photoUrl: '/uploads/jan.jpg' },
        { id: 2, name: 'Piet Pietersen', photoUrl: null },
      ],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: multiAuthorArticle }),
    } as Response);

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.authors).toHaveLength(2);
    expect(result.current.data?.authors[0].name).toBe('Jan Jansen');
    expect(result.current.data?.authors[1].name).toBe('Piet Pietersen');
    expect(result.current.data?.authors[1].photoUrl).toBeNull();
  });

  it('should handle article with multiple images', async () => {
    const multiImageArticle: ArticleDetail = {
      ...mockArticle,
      images: [
        { id: 1, url: '/uploads/img1.jpg', caption: 'Image 1', isFeatured: true },
        { id: 2, url: '/uploads/img2.jpg', caption: 'Image 2', isFeatured: false },
        { id: 3, url: '/uploads/img3.jpg', caption: null, isFeatured: false },
      ],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: multiImageArticle }),
    } as Response);

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.images).toHaveLength(3);
    expect(result.current.data?.images.filter(i => i.isFeatured)).toHaveLength(1);
  });

  it('should expose ArticleDetail type correctly', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: mockArticle }),
    } as Response);

    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const article = result.current.data;
    expect(article).toHaveProperty('id');
    expect(article).toHaveProperty('title');
    expect(article).toHaveProperty('chapeau');
    expect(article).toHaveProperty('content');
    expect(article).toHaveProperty('excerpt');
    expect(article).toHaveProperty('category');
    expect(article).toHaveProperty('pageStart');
    expect(article).toHaveProperty('pageEnd');
    expect(article).toHaveProperty('editionId');
    expect(article).toHaveProperty('editionNumber');
    expect(article).toHaveProperty('authors');
    expect(article).toHaveProperty('featuredImage');
    expect(article).toHaveProperty('images');
  });
});
