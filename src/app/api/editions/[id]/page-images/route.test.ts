/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock Prisma
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    edition: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    pageImage: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

describe('GET /api/editions/[id]/page-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return page images for a valid edition', async () => {
    mockFindUnique.mockResolvedValue({ id: 1 });
    mockFindMany.mockResolvedValue([
      { id: 1, page_number: 1, image_url: '/uploads/page-1.png' },
      { id: 2, page_number: 2, image_url: '/uploads/page-2.png' },
    ]);

    const request = new NextRequest('http://localhost/api/editions/1/page-images');
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toEqual({
      id: 1,
      pageNumber: 1,
      imageUrl: '/uploads/page-1.png',
    });
  });

  it('should return 400 for invalid edition ID', async () => {
    const request = new NextRequest('http://localhost/api/editions/invalid/page-images');
    const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for negative edition ID', async () => {
    const request = new NextRequest('http://localhost/api/editions/-1/page-images');
    const response = await GET(request, { params: Promise.resolve({ id: '-1' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 when edition not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/editions/999/page-images');
    const response = await GET(request, { params: Promise.resolve({ id: '999' }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should return 500 on database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/editions/1/page-images');
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('should order page images by page number', async () => {
    mockFindUnique.mockResolvedValue({ id: 1 });
    mockFindMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/editions/1/page-images');
    await GET(request, { params: Promise.resolve({ id: '1' }) });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { edition_id: 1 },
      orderBy: { page_number: 'asc' },
    });
  });
});
