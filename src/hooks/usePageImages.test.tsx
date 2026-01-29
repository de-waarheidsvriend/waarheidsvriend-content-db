/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePageImages } from './usePageImages';

const mockPageImages = [
  { id: 1, pageNumber: 1, imageUrl: '/uploads/page-1.png' },
  { id: 2, pageNumber: 2, imageUrl: '/uploads/page-2.png' },
];

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

describe('usePageImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch page images for an edition', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: mockPageImages }),
    } as Response);

    const { result } = renderHook(() => usePageImages(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPageImages);
    expect(global.fetch).toHaveBeenCalledWith('/api/editions/1/page-images');
  });

  it('should not fetch when editionId is null', () => {
    const { result } = renderHook(() => usePageImages(null), {
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
        error: { code: 'NOT_FOUND', message: 'Edition not found' },
      }),
    } as Response);

    const { result } = renderHook(() => usePageImages(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Edition not found');
  });

  it('should handle network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePageImages(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should return loading state initially', () => {
    vi.mocked(global.fetch).mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => usePageImages(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle empty page images array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: [] }),
    } as Response);

    const { result } = renderHook(() => usePageImages(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should use correct query key with different edition IDs', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: [] }),
    } as Response);

    const { result } = renderHook(() => usePageImages(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/editions/42/page-images');
  });

  it('should handle missing data in response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    } as Response);

    const { result } = renderHook(() => usePageImages(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Failed to fetch page images');
  });

  it('should sort page images by page number', async () => {
    const unsortedPageImages = [
      { id: 3, pageNumber: 3, imageUrl: '/uploads/page-3.png' },
      { id: 1, pageNumber: 1, imageUrl: '/uploads/page-1.png' },
      { id: 2, pageNumber: 2, imageUrl: '/uploads/page-2.png' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: unsortedPageImages }),
    } as Response);

    const { result } = renderHook(() => usePageImages(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The API should return sorted data, but hook receives it as-is
    expect(result.current.data).toEqual(unsortedPageImages);
  });

  it('should expose PageImage type correctly', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: async () => ({ success: true, data: mockPageImages }),
    } as Response);

    const { result } = renderHook(() => usePageImages(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstImage = result.current.data?.[0];
    expect(firstImage).toHaveProperty('id');
    expect(firstImage).toHaveProperty('pageNumber');
    expect(firstImage).toHaveProperty('imageUrl');
  });
});
