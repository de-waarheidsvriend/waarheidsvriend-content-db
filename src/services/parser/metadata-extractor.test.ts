import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractMetadata, parseDate } from './metadata-extractor';
import { readdir, readFile } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

describe('metadata-extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractMetadata', () => {
    it('should return null values when no HTML files are found', async () => {
      vi.mocked(readdir).mockResolvedValue([]);

      const result = await extractMetadata('/test/xhtml');

      expect(result).toEqual({
        editionNumber: null,
        editionDate: null,
      });
    });

    it('should extract edition number from HTML content', async () => {
      vi.mocked(readdir).mockResolvedValue(['publication.html'] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div>Jaargang 42</div>
            <div>15 januari 2026</div>
          </body>
        </html>
      `);

      const result = await extractMetadata('/test/xhtml');

      expect(result.editionNumber).toBe(42);
    });

    it('should extract edition date from HTML content', async () => {
      vi.mocked(readdir).mockResolvedValue(['publication.html'] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div>Jaargang 42</div>
            <div>15 januari 2026</div>
          </body>
        </html>
      `);

      const result = await extractMetadata('/test/xhtml');

      expect(result.editionDate).toEqual(new Date(2026, 0, 15));
    });

    it('should handle "Nr." format for edition number', async () => {
      vi.mocked(readdir).mockResolvedValue(['publication.html'] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div>Nr. 123</div>
          </body>
        </html>
      `);

      const result = await extractMetadata('/test/xhtml');

      expect(result.editionNumber).toBe(123);
    });

    it('should handle different month names', async () => {
      const months = [
        { name: 'januari', index: 0 },
        { name: 'februari', index: 1 },
        { name: 'maart', index: 2 },
        { name: 'april', index: 3 },
        { name: 'mei', index: 4 },
        { name: 'juni', index: 5 },
        { name: 'juli', index: 6 },
        { name: 'augustus', index: 7 },
        { name: 'september', index: 8 },
        { name: 'oktober', index: 9 },
        { name: 'november', index: 10 },
        { name: 'december', index: 11 },
      ];

      for (const { name, index } of months) {
        vi.mocked(readdir).mockResolvedValue(['publication.html'] as unknown as Awaited<ReturnType<typeof readdir>>);
        vi.mocked(readFile).mockResolvedValue(`
          <html><body><div>1 ${name} 2026</div></body></html>
        `);

        const result = await extractMetadata('/test/xhtml');

        expect(result.editionDate?.getMonth()).toBe(index);
      }
    });

    it('should return null values when HTML content has no metadata', async () => {
      vi.mocked(readdir).mockResolvedValue(['publication.html'] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div>Some content without metadata</div>
          </body>
        </html>
      `);

      const result = await extractMetadata('/test/xhtml');

      expect(result).toEqual({
        editionNumber: null,
        editionDate: null,
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(readdir).mockRejectedValue(new Error('Directory not found'));

      const result = await extractMetadata('/test/xhtml');

      expect(result).toEqual({
        editionNumber: null,
        editionDate: null,
      });
    });

    it('should search multiple HTML files for metadata', async () => {
      vi.mocked(readdir).mockResolvedValue(['publication.html', 'publication-1.html'] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile)
        .mockResolvedValueOnce('<html><body>No metadata here</body></html>')
        .mockResolvedValueOnce('<html><body>Jaargang 50 - 20 maart 2026</body></html>');

      const result = await extractMetadata('/test/xhtml');

      expect(result.editionNumber).toBe(50);
      expect(result.editionDate).toEqual(new Date(2026, 2, 20));
    });
  });

  describe('parseDate', () => {
    it('should parse Dutch date correctly', () => {
      expect(parseDate('15', 'januari', '2026')).toEqual(new Date(2026, 0, 15));
      expect(parseDate('1', 'december', '2025')).toEqual(new Date(2025, 11, 1));
    });

    it('should handle case-insensitive month names', () => {
      expect(parseDate('15', 'JANUARI', '2026')).toEqual(new Date(2026, 0, 15));
      expect(parseDate('15', 'Januari', '2026')).toEqual(new Date(2026, 0, 15));
    });
  });
});
