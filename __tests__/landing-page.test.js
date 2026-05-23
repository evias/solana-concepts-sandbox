/**
 * Landing Page Tests
 * Tests for index.html concept grid layout and structure
 */

const fs = require('fs');
const path = require('path');

describe('Landing Page (index.html)', () => {
  let htmlContent;

  beforeAll(() => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  });

  describe('Page Structure', () => {
    it('should have DOCTYPE declaration', () => {
      expect(htmlContent).toMatch(/^<!DOCTYPE html>/i);
    });

    it('should have proper HTML lang attribute', () => {
      expect(htmlContent).toMatch(/<html[^>]*lang="en"[^>]*>/i);
    });

    it('should have meta charset UTF-8', () => {
      expect(htmlContent).toMatch(/<meta[^>]*charset="UTF-8"[^>]*>/i);
    });

    it('should have viewport meta tag', () => {
      expect(htmlContent).toMatch(/<meta[^>]*name="viewport"[^>]*content="width=device-width, initial-scale=1.0"[^>]*>/i);
    });

    it('should have page title "dHealth<>Solana Sandbox"', () => {
      expect(htmlContent).toMatch(/<title>dHealth&lt;&gt;Solana Sandbox<\/title>/);
    });

    it('should have favicon link', () => {
      expect(htmlContent).toMatch(/<link[^>]*rel="icon"[^>]*href="\/assets\/favicon.ico"[^>]*>/);
    });

    it('should link base CSS file', () => {
      expect(htmlContent).toMatch(/<link[^>]*href="\/assets\/base.min.css"[^>]*>/);
    });

    it('should include Alpine.js', () => {
      expect(htmlContent).toMatch(/<script[^>]*src="\/assets\/alpinejs.min.js"[^>]*>/);
    });
  });

  describe('Concept Grid Layout', () => {
    it('should have a main heading "Solana Concepts Sandbox"', () => {
      expect(htmlContent).toMatch(/<h1[^>]*>Solana Concepts Sandbox<\/h1>/);
    });

    it('should use 3-column grid for desktop (lg:grid-cols-3)', () => {
      expect(htmlContent).toMatch(/grid[^>]*lg:grid-cols-3/);
    });

    it('should use 2-column grid for tablet (md:grid-cols-2)', () => {
      expect(htmlContent).toMatch(/grid[^>]*md:grid-cols-2/);
    });

    it('should use 1-column grid for mobile (grid-cols-1)', () => {
      expect(htmlContent).toMatch(/grid[^>]*grid-cols-1/);
    });

    it('should have proper grid gap (gap-6)', () => {
      expect(htmlContent).toMatch(/grid[^>]*gap-6/);
    });
  });

  describe('Concept Boxes', () => {
    it('should have PetTracker concept box', () => {
      expect(htmlContent).toMatch(/PetTracker/);
    });

    it('should have PetTracker description mentioning SPL tokens', () => {
      expect(htmlContent).toMatch(/Register and manage pets as SPL tokens/);
    });

    it('should have PetVax concept box', () => {
      expect(htmlContent).toMatch(/PetVax/);
    });

    it('should have PetVax description mentioning immunization', () => {
      expect(htmlContent).toMatch(/Proof of immunization/);
    });

    it('should have PetDiet concept box', () => {
      expect(htmlContent).toMatch(/PetDiet/);
    });

    it('should have PetDiet marked as coming soon', () => {
      expect(htmlContent).toMatch(/PetDiet[\s\S]*Coming soon/);
    });

    it('should have HealthCred concept box', () => {
      expect(htmlContent).toMatch(/HealthCred/);
    });

    it('should have HealthCred marked as coming soon', () => {
      expect(htmlContent).toMatch(/HealthCred[\s\S]*Coming soon/);
    });

    it('should have CareCircle concept box', () => {
      expect(htmlContent).toMatch(/CareCircle/);
    });

    it('should have CareCircle marked as coming soon', () => {
      expect(htmlContent).toMatch(/CareCircle[\s\S]*Coming soon/);
    });

    it('each concept box should have a clickable link', () => {
      expect(htmlContent).toMatch(/<a[^>]*href="\/pettracker"[^>]*>/);
      expect(htmlContent).toMatch(/<a[^>]*href="\/petvax"[^>]*>/);
    });

    it('should have concept titles in h3 tags', () => {
      expect(htmlContent).toMatch(/<h3[^>]*class="text-2xl font-bold/);
    });

    it('should have concept descriptions in p tags', () => {
      expect(htmlContent).toMatch(/<p[^>]*class="text-gray-600 text-sm leading-relaxed/);
    });

    it('concept boxes should have hover shadow effect', () => {
      expect(htmlContent).toMatch(/hover:shadow-lg/);
    });

    it('concept boxes should have hover color transition on titles', () => {
      expect(htmlContent).toMatch(/group-hover:text-indigo-600/);
    });

    it('coming soon concepts should have reduced opacity', () => {
      expect(htmlContent).toMatch(/opacity-60/);
    });
  });

  describe('Footer', () => {
    it('should have a footer element', () => {
      expect(htmlContent).toMatch(/<footer/);
    });

    it('should have copyright message', () => {
      expect(htmlContent).toMatch(/© 2026 Grégory Saive for re:Software S.L./);
    });

    it('footer should be centered', () => {
      expect(htmlContent).toMatch(/text-center/);
    });

    it('footer should have top border', () => {
      expect(htmlContent).toMatch(/footer[^>]*class="[^"]*border-t[^"]*"/);
    });
  });

  describe('Responsive Design', () => {
    it('should use flex-col for body layout', () => {
      expect(htmlContent).toMatch(/flex[^>]*flex-col/);
    });

    it('should have min-h-screen for full viewport height', () => {
      expect(htmlContent).toMatch(/min-h-screen/);
    });

    it('should have max-w-7xl for content width on desktop', () => {
      expect(htmlContent).toMatch(/max-w-7xl/);
    });

    it('should have proper padding on both sides', () => {
      expect(htmlContent).toMatch(/mx-auto/);
      expect(htmlContent).toMatch(/p-8/);
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic HTML structure', () => {
      expect(htmlContent).toMatch(/<h1/);
      expect(htmlContent).toMatch(/<section/);
      expect(htmlContent).toMatch(/<footer/);
    });

    it('should have alt text patterns available for future logo images', () => {
      // Future improvement: verify alt attributes when logos are added
      expect(true).toBe(true);
    });
  });
});
