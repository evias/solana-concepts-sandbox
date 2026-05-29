/**
 * Footer Tests
 * Tests for footer sections across all pages (landing, pettracker, petvax)
 */

const fs = require('fs');
const path = require('path');

describe('Footer - All Pages', () => {
  const pages = [
    { name: 'Landing Page', filename: 'index.html' },
    { name: 'PetTracker', filename: 'concepts/pettracker.html' },
    { name: 'PetVax', filename: 'concepts/petvax.html' }
  ];

  pages.forEach(page => {
    describe(`${page.name} (${page.filename})`, () => {
      let htmlContent;

      beforeAll(() => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      });

      it('should have footer element', () => {
        expect(htmlContent).toMatch(/<footer/);
      });

      it('footer should have white background', () => {
        expect(htmlContent).toMatch(/footer[^>]*class="[^"]*bg-white[^"]*"/);
      });

      it('footer should have top border', () => {
        expect(htmlContent).toMatch(/footer[^>]*class="[^"]*border-t[^"]*"/);
      });

      it('should have sponsor section in footer', () => {
        expect(htmlContent).toMatch(/<!-- Sponsors in Footer -->/);
      });

      it('should have evi.as sponsor link', () => {
        expect(htmlContent).toMatch(/href="https:\/\/evi.as"[\s\S]*?evias-logo.png/);
      });

      it('should have re:Software sponsor link', () => {
        expect(htmlContent).toMatch(/href="https:\/\/resoftware.es"[\s\S]*?resoftware-logo.png/);
      });

      it('should have dHealth sponsor link', () => {
        expect(htmlContent).toMatch(/href="https:\/\/dhealth.com"[\s\S]*?dhealth-logo.png/);
      });

      it('sponsors should be responsive (flex-col on mobile, flex-row on desktop)', () => {
        expect(htmlContent).toMatch(/flex[^>]*flex-col[^>]*md:flex-row/);
      });

      it('sponsor links should open in new tab', () => {
        expect(htmlContent).toMatch(/target="_blank"[\s\S]*?rel="noopener noreferrer"/);
      });

      it('sponsor logos should have reduced opacity', () => {
        expect(htmlContent).toMatch(/opacity-60/);
      });

      it('sponsor logos should have hover opacity effect', () => {
        expect(htmlContent).toMatch(/hover:opacity-100/);
      });

      it('sponsor logos should have image tags with alt text', () => {
        expect(htmlContent).toMatch(/<img[^>]*alt="Evi.as logo"/);
        expect(htmlContent).toMatch(/<img[^>]*alt="re:Software logo"/);
        expect(htmlContent).toMatch(/<img[^>]*alt="dHealth logo"/);
      });

      it('sponsor logos should have h-8 height class', () => {
        expect(htmlContent).toMatch(/h-8/);
      });

      it('should have copyright section', () => {
        expect(htmlContent).toMatch(/<!-- Copyright -->/);
      });

      it('should have proper copyright text', () => {
        expect(htmlContent).toMatch(/© 2026[\s\S]*?Grégory Saive[\s\S]*?re:Software S.L./);
      });

      it('copyright should say "All rights reserved"', () => {
        expect(htmlContent).toMatch(/All rights reserved/);
      });

      it('copyright section should be centered', () => {
        expect(htmlContent).toMatch(/text-center/);
      });

      it('copyright text should be gray with small font', () => {
        expect(htmlContent).toMatch(/text-gray-600[\s\S]*?text-sm/);
      });

      it('copyright section should have top border', () => {
        expect(htmlContent).toMatch(/border-t[\s\S]*?copyright/i);
      });

      it('sponsor section should have proper spacing (gap-6)', () => {
        expect(htmlContent).toMatch(/gap-6[\s\S]*?evias-logo/);
      });

      it('footer should use max-w-7xl for width on desktop', () => {
        expect(htmlContent).toMatch(/max-w-7xl[\s\S]*?footer/);
      });

      it('footer px should be responsive', () => {
        expect(htmlContent).toMatch(/px-8[\s\S]*?footer/);
      });

      it('footer py should have 8 units of padding', () => {
        expect(htmlContent).toMatch(/py-8[\s\S]*?footer/);
      });
    });
  });

  describe('Footer Consistency Across All Pages', () => {
    it('all pages should have footer element', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/<footer/);
      });
    });

    it('all pages should have sponsor section with all 3 sponsors', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/evi.as/);
        expect(content).toMatch(/resoftware/);
        expect(content).toMatch(/dhealth/);
      });
    });

    it('all pages should have copyright text', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/© 2026[\s\S]*?Grégory Saive/);
      });
    });

    it('all pages should have same footer styling', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/bg-white/);
        expect(content).toMatch(/border-t/);
        expect(content).toMatch(/footer/);
      });
    });

    it('all sponsor logo images exist in references', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/\/assets\/evias-logo.png/);
        expect(content).toMatch(/\/assets\/resoftware-logo.png/);
        expect(content).toMatch(/\/assets\/dhealth-logo.png/);
      });
    });
  });

  describe('Footer Accessibility', () => {
    it('sponsor links should have title attributes', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/title="Visit/);
      });
    });

    it('sponsor images should have alt text for screen readers', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/alt="/);
      });
    });

    it('footer should be semantic with footer element', () => {
      pages.forEach(page => {
        const htmlPath = path.join(__dirname, '..', page.filename);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(/<footer[\s\S]*<\/footer>/);
      });
    });
  });
});
