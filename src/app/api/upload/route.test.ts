import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Track mock state for AdmZip
let shouldExtractFail = false;

// Mock modules before importing the route
vi.mock('@/lib/db', () => ({
  prisma: {
    edition: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock adm-zip with controllable behavior
vi.mock('adm-zip', () => {
  return {
    default: class MockAdmZip {
      extractAllTo = vi.fn(() => {
        if (shouldExtractFail) {
          throw new Error('Invalid ZIP file');
        }
      });
      constructor() {}
    }
  };
});

// Mock metadata extractor
vi.mock('@/services/parser/metadata-extractor', () => ({
  extractMetadata: vi.fn().mockResolvedValue({
    editionNumber: null,
    editionDate: null,
  }),
}));

// Import after mocks are set up
import { POST } from './route';
import { prisma } from '@/lib/db';
import { rm } from 'fs/promises';
import { extractMetadata } from '@/services/parser/metadata-extractor';

describe('Upload API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldExtractFail = false;
    // Mock successful edition creation
    vi.mocked(prisma.edition.create).mockResolvedValue({
      id: 1,
      edition_number: 0,
      edition_date: new Date(),
      status: 'processing',
      created_at: new Date(),
      updated_at: new Date(),
    });
    // Mock metadata extractor return value
    vi.mocked(extractMetadata).mockResolvedValue({
      editionNumber: null,
      editionDate: null,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return 400 when XHTML zip is missing', async () => {
    const formData = new FormData();
    const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    formData.append('pdf', pdfBlob, 'test.pdf');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when PDF is missing', async () => {
    const formData = new FormData();
    const zipBlob = new Blob(['zip content'], { type: 'application/zip' });
    formData.append('xhtml', zipBlob, 'test.zip');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when both files are missing', async () => {
    const formData = new FormData();

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('should create edition and return success when both files are provided', async () => {
    const formData = new FormData();
    const zipBlob = new Blob(['zip content'], { type: 'application/zip' });
    const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    formData.append('xhtml', zipBlob, 'test.zip');
    formData.append('pdf', pdfBlob, 'test.pdf');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.editionId).toBe(1);
    expect(json.data.status).toBe('processing');
    expect(json.data.message).toBeDefined();
  });

  it('should create edition record with status "processing" and temporary edition_number', async () => {
    const formData = new FormData();
    const zipBlob = new Blob(['zip content'], { type: 'application/zip' });
    const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    formData.append('xhtml', zipBlob, 'test.zip');
    formData.append('pdf', pdfBlob, 'test.pdf');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    await POST(request);

    expect(prisma.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'processing',
        edition_number: expect.any(Number),
      }),
    });

    // Verify temporary edition_number is negative (timestamp-based)
    const callArg = vi.mocked(prisma.edition.create).mock.calls[0][0];
    expect(callArg.data.edition_number).toBeLessThan(0);
  });

  it('should return 500 when database creation fails', async () => {
    vi.mocked(prisma.edition.create).mockRejectedValue(new Error('DB Error'));

    const formData = new FormData();
    const zipBlob = new Blob(['zip content'], { type: 'application/zip' });
    const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    formData.append('xhtml', zipBlob, 'test.zip');
    formData.append('pdf', pdfBlob, 'test.pdf');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INTERNAL_ERROR');
  });

  it('should update edition with extracted metadata when metadata is found', async () => {
    vi.mocked(extractMetadata).mockResolvedValue({
      editionNumber: 42,
      editionDate: new Date(2026, 0, 15),
    });
    vi.mocked(prisma.edition.update).mockResolvedValue({
      id: 1,
      edition_number: 42,
      edition_date: new Date(2026, 0, 15),
      status: 'processing',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const formData = new FormData();
    const zipBlob = new Blob(['zip content'], { type: 'application/zip' });
    const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    formData.append('xhtml', zipBlob, 'test.zip');
    formData.append('pdf', pdfBlob, 'test.pdf');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    await POST(request);

    expect(prisma.edition.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        edition_number: 42,
      }),
    });
  });

  it('should not update edition when no metadata is found', async () => {
    vi.mocked(extractMetadata).mockResolvedValue({
      editionNumber: null,
      editionDate: null,
    });

    const formData = new FormData();
    const zipBlob = new Blob(['zip content'], { type: 'application/zip' });
    const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    formData.append('xhtml', zipBlob, 'test.zip');
    formData.append('pdf', pdfBlob, 'test.pdf');

    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    await POST(request);

    expect(prisma.edition.update).not.toHaveBeenCalled();
  });

  describe('File Type Validation', () => {
    it('should return 400 when XHTML file is not a ZIP', async () => {
      const formData = new FormData();
      const textBlob = new Blob(['not a zip'], { type: 'text/plain' });
      const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
      formData.append('xhtml', textBlob, 'test.txt');
      formData.append('pdf', pdfBlob, 'test.pdf');

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('ZIP');
    });

    it('should return 400 when PDF file is not a PDF', async () => {
      const formData = new FormData();
      const zipBlob = new Blob(['zip content'], { type: 'application/zip' });
      const textBlob = new Blob(['not a pdf'], { type: 'text/plain' });
      formData.append('xhtml', zipBlob, 'test.zip');
      formData.append('pdf', textBlob, 'test.txt');

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('PDF');
    });

    it('should accept files with correct extension even if MIME type is generic', async () => {
      const formData = new FormData();
      // Some browsers send application/octet-stream for unknown types
      const zipBlob = new Blob(['zip content'], { type: 'application/octet-stream' });
      const pdfBlob = new Blob(['pdf content'], { type: 'application/octet-stream' });
      formData.append('xhtml', zipBlob, 'test.zip');
      formData.append('pdf', pdfBlob, 'test.pdf');

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('Rollback on Failure', () => {
    it('should delete edition record and files when ZIP extraction fails', async () => {
      // Enable failure mode for this test
      shouldExtractFail = true;

      const formData = new FormData();
      const zipBlob = new Blob(['invalid zip'], { type: 'application/zip' });
      const pdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
      formData.append('xhtml', zipBlob, 'test.zip');
      formData.append('pdf', pdfBlob, 'test.pdf');

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_ERROR');

      // Verify cleanup was attempted
      expect(prisma.edition.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(rm).toHaveBeenCalled();
    });
  });
});
