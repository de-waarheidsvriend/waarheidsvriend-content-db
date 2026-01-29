import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeStyles,
  analyzeHtmlClasses,
  mergeStyleAnalysis,
} from "./structure-analyzer";
import { readdir, readFile } from "fs/promises";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

describe("structure-analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeStyles", () => {
    it("should identify title classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "idGeneratedStyles.css",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        .Titel { font-size: 24px; font-weight: bold; }
        .Kop1 { font-size: 20px; }
        .Title { font-size: 18px; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.titleClasses).toContain("Titel");
      expect(result.titleClasses).toContain("Kop1");
      expect(result.titleClasses).toContain("Title");
    });

    it("should identify chapeau classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Chapeau { font-style: italic; }
        .Intro { font-size: 14px; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.chapeauClasses).toContain("Chapeau");
      expect(result.chapeauClasses).toContain("Intro");
    });

    it("should identify body text classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Broodtekst { font-size: 12px; }
        .Body { line-height: 1.5; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.bodyClasses).toContain("Broodtekst");
      expect(result.bodyClasses).toContain("Body");
    });

    it("should identify author classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Auteur { font-style: italic; }
        .Author { color: gray; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.authorClasses).toContain("Auteur");
      expect(result.authorClasses).toContain("Author");
    });

    it("should identify category classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Rubriek { text-transform: uppercase; }
        .Category { font-weight: bold; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.categoryClasses).toContain("Rubriek");
      expect(result.categoryClasses).toContain("Category");
    });

    it("should identify article boundary classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Artikel { border: 1px solid; }
        .Article { margin: 20px; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.articleBoundaryClasses).toContain("Artikel");
      expect(result.articleBoundaryClasses).toContain("Article");
    });

    it("should build classMap with semantic meanings", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Titel { font-size: 24px; }
        .Broodtekst { font-size: 12px; }
        .Auteur { font-style: italic; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.classMap.get("Titel")).toBe("title");
      expect(result.classMap.get("Broodtekst")).toBe("body");
      expect(result.classMap.get("Auteur")).toBe("author");
    });

    it("should process multiple CSS files", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "idGeneratedStyles.css",
        "main.css",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile)
        .mockResolvedValueOnce(".Titel { font-size: 24px; }")
        .mockResolvedValueOnce(".Auteur { font-style: italic; }");

      const result = await analyzeStyles("/test/css");

      expect(result.titleClasses).toContain("Titel");
      expect(result.authorClasses).toContain("Auteur");
    });

    it("should handle empty CSS directory gracefully", async () => {
      vi.mocked(readdir).mockResolvedValue([] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);

      const result = await analyzeStyles("/test/css");

      expect(result.classMap.size).toBe(0);
      expect(result.titleClasses).toHaveLength(0);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(readdir).mockRejectedValue(new Error("Directory not found"));

      const result = await analyzeStyles("/test/css");

      expect(result.classMap.size).toBe(0);
    });

    it("should skip non-CSS files", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "styles.css",
        "readme.txt",
        "image.png",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(".Titel { font-size: 24px; }");

      await analyzeStyles("/test/css");

      // readFile should only be called once (for the CSS file)
      expect(vi.mocked(readFile)).toHaveBeenCalledTimes(1);
    });

    it("should handle classes with numbers and special characters", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Titel-1 { font-size: 24px; }
        .Kop_groot { font-size: 20px; }
        ._hidden { display: none; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.titleClasses).toContain("Titel-1");
      expect(result.titleClasses).toContain("Kop_groot");
    });

    it("should skip InDesign override classes", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .CharOverride-1 { font-size: 24px; }
        .ParaOverride-2 { margin: 10px; }
        ._idGenObjectAttribute-1 { display: block; }
        .Titel { font-size: 24px; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.classMap.has("CharOverride-1")).toBe(false);
      expect(result.classMap.has("ParaOverride-2")).toBe(false);
      expect(result.classMap.has("_idGenObjectAttribute-1")).toBe(false);
      expect(result.titleClasses).toContain("Titel");
    });

    it("should identify subheading classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Tussenkop { font-size: 16px; }
        .Hoofdartikel_Tussenkop-lichtblauw { color: blue; }
        .Subheading { font-weight: bold; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.subheadingClasses).toContain("Tussenkop");
      expect(result.subheadingClasses).toContain("Hoofdartikel_Tussenkop-lichtblauw");
      expect(result.subheadingClasses).toContain("Subheading");
    });

    it("should identify streamer/quote classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Streamer { font-style: italic; }
        .Artikelen_Streamer-Blauw-Gecentreerd { color: blue; }
        .Quote { font-size: 18px; }
        .Citaat { border-left: 3px solid; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.streamerClasses).toContain("Streamer");
      expect(result.streamerClasses).toContain("Artikelen_Streamer-Blauw-Gecentreerd");
      expect(result.streamerClasses).toContain("Quote");
      expect(result.streamerClasses).toContain("Citaat");
    });

    it("should identify sidebar/kader classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Kader { border: 1px solid; }
        .Kaders_Platte-tekst { font-size: 12px; }
        .Sidebar { background: gray; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.sidebarClasses).toContain("Kader");
      expect(result.sidebarClasses).toContain("Kaders_Platte-tekst");
      expect(result.sidebarClasses).toContain("Sidebar");
    });

    it("should identify caption classes from CSS", async () => {
      vi.mocked(readdir).mockResolvedValue(["styles.css"] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      vi.mocked(readFile).mockResolvedValue(`
        .Fotobijschrift { font-size: 10px; }
        .Artikelen_Fotobijschrift { color: gray; }
        .Caption { font-style: italic; }
        .Onderschrift { margin-top: 5px; }
      `);

      const result = await analyzeStyles("/test/css");

      expect(result.captionClasses).toContain("Fotobijschrift");
      expect(result.captionClasses).toContain("Artikelen_Fotobijschrift");
      expect(result.captionClasses).toContain("Caption");
      expect(result.captionClasses).toContain("Onderschrift");
    });
  });

  describe("analyzeHtmlClasses", () => {
    it("should extract title classes from HTML class attributes", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div class="Artikelen_Hoofdkop">Title</div>
            <div class="Hoofdartikel_Hoofdkop-wit">Another Title</div>
          </body>
        </html>
      `);

      const result = await analyzeHtmlClasses("/test/html");

      expect(result.titleClasses).toContain("Artikelen_Hoofdkop");
      expect(result.titleClasses).toContain("Hoofdartikel_Hoofdkop-wit");
    });

    it("should extract chapeau classes from HTML", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div class="Artikelen_Chapeau-blauw">Chapeau text</div>
            <div class="Omslag_ankeiler">Ankeiler text</div>
            <div class="Hoofdartikel_Intro-wit">Intro text</div>
          </body>
        </html>
      `);

      const result = await analyzeHtmlClasses("/test/html");

      expect(result.chapeauClasses).toContain("Artikelen_Chapeau-blauw");
      expect(result.chapeauClasses).toContain("Omslag_ankeiler");
      expect(result.chapeauClasses).toContain("Hoofdartikel_Intro-wit");
    });

    it("should extract author classes from HTML", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div class="Artikelen_info-auteur">Author info</div>
            <div class="Artikelen_Tekst--geschreven-door">Written by</div>
          </body>
        </html>
      `);

      const result = await analyzeHtmlClasses("/test/html");

      expect(result.authorClasses).toContain("Artikelen_info-auteur");
      expect(result.authorClasses).toContain("Artikelen_Tekst--geschreven-door");
    });

    it("should extract category/theme classes from HTML", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div class="Algemeen_Thema-bondsnieuws">Theme</div>
            <div class="Algemeen_Thema-Column">Column</div>
          </body>
        </html>
      `);

      const result = await analyzeHtmlClasses("/test/html");

      expect(result.categoryClasses).toContain("Algemeen_Thema-bondsnieuws");
      expect(result.categoryClasses).toContain("Algemeen_Thema-Column");
    });

    it("should extract body text classes from HTML", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div class="Hoofdartikel_Platte-tekst">Body text</div>
            <div class="Artikelen_Broodtekst">Broodtekst</div>
          </body>
        </html>
      `);

      const result = await analyzeHtmlClasses("/test/html");

      expect(result.bodyClasses).toContain("Hoofdartikel_Platte-tekst");
      expect(result.bodyClasses).toContain("Artikelen_Broodtekst");
    });

    it("should handle multiple classes in one attribute", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(`
        <html>
          <body>
            <div class="Artikelen_Hoofdkop ParaOverride-1 CharOverride-2">Title</div>
          </body>
        </html>
      `);

      const result = await analyzeHtmlClasses("/test/html");

      // Should only include semantic class, not overrides
      expect(result.titleClasses).toContain("Artikelen_Hoofdkop");
      expect(result.classMap.has("ParaOverride-1")).toBe(false);
      expect(result.classMap.has("CharOverride-2")).toBe(false);
    });

    it("should skip non-HTML files", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
        "styles.css",
        "image.png",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockResolvedValue(
        '<div class="Artikelen_Hoofdkop">Title</div>'
      );

      await analyzeHtmlClasses("/test/html");

      expect(vi.mocked(readFile)).toHaveBeenCalledTimes(1);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(readdir).mockRejectedValue(new Error("Directory not found"));

      const result = await analyzeHtmlClasses("/test/html");

      expect(result.classMap.size).toBe(0);
    });

    it("should process multiple HTML files", async () => {
      vi.mocked(readdir).mockResolvedValue([
        "publication.html",
        "publication-1.html",
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile)
        .mockResolvedValueOnce('<div class="Artikelen_Hoofdkop">Title</div>')
        .mockResolvedValueOnce('<div class="Artikelen_info-auteur">Author</div>');

      const result = await analyzeHtmlClasses("/test/html");

      expect(result.titleClasses).toContain("Artikelen_Hoofdkop");
      expect(result.authorClasses).toContain("Artikelen_info-auteur");
    });
  });

  describe("mergeStyleAnalysis", () => {
    it("should merge two StyleAnalysis objects", () => {
      const a = {
        classMap: new Map([["Titel", "title"]]),
        articleBoundaryClasses: [],
        titleClasses: ["Titel"],
        chapeauClasses: [],
        bodyClasses: [],
        authorClasses: [],
        categoryClasses: [],
        subheadingClasses: [],
        streamerClasses: [],
        sidebarClasses: [],
        captionClasses: [],
      };

      const b = {
        classMap: new Map([["Auteur", "author"]]),
        articleBoundaryClasses: [],
        titleClasses: [],
        chapeauClasses: [],
        bodyClasses: [],
        authorClasses: ["Auteur"],
        categoryClasses: [],
        subheadingClasses: [],
        streamerClasses: [],
        sidebarClasses: [],
        captionClasses: [],
      };

      const result = mergeStyleAnalysis(a, b);

      expect(result.titleClasses).toContain("Titel");
      expect(result.authorClasses).toContain("Auteur");
      expect(result.classMap.get("Titel")).toBe("title");
      expect(result.classMap.get("Auteur")).toBe("author");
    });

    it("should not duplicate classes when merging", () => {
      const a = {
        classMap: new Map([["Titel", "title"]]),
        articleBoundaryClasses: [],
        titleClasses: ["Titel"],
        chapeauClasses: [],
        bodyClasses: [],
        authorClasses: [],
        categoryClasses: [],
        subheadingClasses: [],
        streamerClasses: [],
        sidebarClasses: [],
        captionClasses: [],
      };

      const b = {
        classMap: new Map([["Titel", "title"]]),
        articleBoundaryClasses: [],
        titleClasses: ["Titel"],
        chapeauClasses: [],
        bodyClasses: [],
        authorClasses: [],
        categoryClasses: [],
        subheadingClasses: [],
        streamerClasses: [],
        sidebarClasses: [],
        captionClasses: [],
      };

      const result = mergeStyleAnalysis(a, b);

      expect(result.titleClasses).toHaveLength(1);
      expect(result.titleClasses).toContain("Titel");
    });

    it("should merge all category arrays", () => {
      const a = {
        classMap: new Map(),
        articleBoundaryClasses: ["Artikel-1"],
        titleClasses: ["Titel-1"],
        chapeauClasses: ["Chapeau-1"],
        bodyClasses: ["Body-1"],
        authorClasses: ["Auteur-1"],
        categoryClasses: ["Rubriek-1"],
        subheadingClasses: ["Tussenkop-1"],
        streamerClasses: ["Streamer-1"],
        sidebarClasses: ["Kader-1"],
        captionClasses: ["Bijschrift-1"],
      };

      const b = {
        classMap: new Map(),
        articleBoundaryClasses: ["Artikel-2"],
        titleClasses: ["Titel-2"],
        chapeauClasses: ["Chapeau-2"],
        bodyClasses: ["Body-2"],
        authorClasses: ["Auteur-2"],
        categoryClasses: ["Rubriek-2"],
        subheadingClasses: ["Tussenkop-2"],
        streamerClasses: ["Streamer-2"],
        sidebarClasses: ["Kader-2"],
        captionClasses: ["Bijschrift-2"],
      };

      const result = mergeStyleAnalysis(a, b);

      expect(result.articleBoundaryClasses).toContain("Artikel-1");
      expect(result.articleBoundaryClasses).toContain("Artikel-2");
      expect(result.titleClasses).toContain("Titel-1");
      expect(result.titleClasses).toContain("Titel-2");
      expect(result.chapeauClasses).toContain("Chapeau-1");
      expect(result.chapeauClasses).toContain("Chapeau-2");
      expect(result.bodyClasses).toContain("Body-1");
      expect(result.bodyClasses).toContain("Body-2");
      expect(result.authorClasses).toContain("Auteur-1");
      expect(result.authorClasses).toContain("Auteur-2");
      expect(result.categoryClasses).toContain("Rubriek-1");
      expect(result.categoryClasses).toContain("Rubriek-2");
      expect(result.subheadingClasses).toContain("Tussenkop-1");
      expect(result.subheadingClasses).toContain("Tussenkop-2");
      expect(result.streamerClasses).toContain("Streamer-1");
      expect(result.streamerClasses).toContain("Streamer-2");
      expect(result.sidebarClasses).toContain("Kader-1");
      expect(result.sidebarClasses).toContain("Kader-2");
      expect(result.captionClasses).toContain("Bijschrift-1");
      expect(result.captionClasses).toContain("Bijschrift-2");
    });
  });
});
