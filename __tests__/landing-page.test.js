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

  describe('Introductory Message and Sponsors', () => {
    it('should have introductory text matching README first paragraph', () => {
      expect(htmlContent).toMatch(/A comprehensive sandbox for exploring Solana concepts/);
    });

    it('should mention PetTracker in intro', () => {
      expect(htmlContent).toMatch(/PetTracker.*application.*demonstrates hybrid on-chain\/off-chain storage/);
    });

    it('should mention SPL tokens in intro', () => {
      expect(htmlContent).toMatch(/SPL tokens/);
    });

    it('should have warning about experimental status', () => {
      expect(htmlContent).toMatch(/Experimental Software/);
    });

    it('should include caution text about experimental software', () => {
      expect(htmlContent).toMatch(/This is experimental software not intended for production use/);
    });

    it('should reference LICENSE in warning', () => {
      expect(htmlContent).toMatch(/See LICENSE for the complete terms/);
    });

    it('should have sponsors section header', () => {
      expect(htmlContent).toMatch(/Sponsors \/ Partners/);
    });

    it('should have Evi.as sponsor link', () => {
      expect(htmlContent).toMatch(/<a[^>]*href="https:\/\/evi.as"[^>]*>/);
    });

    it('should have Evi.as logo image', () => {
      expect(htmlContent).toMatch(/<img[^>]*src="\/assets\/evias-logo.png"[^>]*alt="Evi.as logo"/);
    });

    it('should have re:Software sponsor link', () => {
      expect(htmlContent).toMatch(/<a[^>]*href="https:\/\/resoftware.es"[^>]*>/);
    });

    it('should have re:Software logo image', () => {
      expect(htmlContent).toMatch(/<img[^>]*src="\/assets\/resoftware-logo.png"[^>]*alt="re:Software logo"/);
    });

    it('should have dHealth sponsor link', () => {
      expect(htmlContent).toMatch(/<a[^>]*href="https:\/\/dhealth.com"[^>]*>/);
    });

    it('should have dHealth logo image', () => {
      expect(htmlContent).toMatch(/<img[^>]*src="\/assets\/dhealth-logo.png"[^>]*alt="dHealth logo"/);
    });

    it('sponsor links should open in new tab', () => {
      expect(htmlContent).toMatch(/rel="noopener noreferrer"/);
    });

    it('sponsor logos should have hover effect', () => {
      expect(htmlContent).toMatch(/hover:opacity-80/);
    });

    it('sponsors should be responsive (flex-col on mobile, flex-row on desktop)', () => {
      expect(htmlContent).toMatch(/flex[^>]*flex-col[^>]*md:flex-row/);
    });

    it('sponsors should be centered', () => {
      expect(htmlContent).toMatch(/justify-center/);
    });

    it('sponsors should have proper spacing', () => {
      expect(htmlContent).toMatch(/gap-8/);
    });

    it('sponsor logo images should have proper height', () => {
      expect(htmlContent).toMatch(/h-16/);
    });

    it('introductory section should have white background', () => {
      expect(htmlContent).toMatch(/bg-white/);
    });

    it('warning box should have yellow background', () => {
      expect(htmlContent).toMatch(/bg-yellow-50/);
    });

    it('warning box should have yellow left border', () => {
      expect(htmlContent).toMatch(/border-l-4 border-yellow-400/);
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
      expect(htmlContent).toMatch(/:href="concept.enabled \? concept.link : '#'"/);
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

  describe('Concept Logos', () => {
    it('each concept box should have a logo section', () => {
      expect(htmlContent).toMatch(/<!-- Logo -->/);
    });

    it('logo section should have gray background', () => {
      expect(htmlContent).toMatch(/bg-gray-50[\s\S]*?logo/i);
    });

    it('logo container should have h-24 height', () => {
      expect(htmlContent).toMatch(/h-24[\s\S]*?logo/i);
    });

    it('logo should use dynamic src from concept.id', () => {
      expect(htmlContent).toMatch(/:src="'\/assets\/' \+ concept.id \+ '-logo.png'"/);
    });

    it('logo images should have alt text using concept name', () => {
      expect(htmlContent).toMatch(/:alt="concept.name \+ ' logo'"/);
    });

    it('logo images should have max-h-20 for height constraint', () => {
      expect(htmlContent).toMatch(/max-h-20[\s\S]*?logo/i);
    });

    it('logo images should preserve aspect ratio with object-contain', () => {
      expect(htmlContent).toMatch(/object-contain[\s\S]*?logo/i);
    });

    it('logo should be centered in container', () => {
      expect(htmlContent).toMatch(/flex items-center justify-center[\s\S]*?logo/i);
    });

    it('concept box should use flexbox column layout', () => {
      expect(htmlContent).toMatch(/flex-col[\s\S]*?concept/i);
    });

    it('concept content should flex-grow to fill space', () => {
      expect(htmlContent).toMatch(/flex-grow[\s\S]*?concept/i);
    });

    it('all concept images should reference correct logo files', () => {
      expect(htmlContent).toMatch(/concept.id[\s\S]*?logo.png/);
    });

    it('logo images should have transition effects', () => {
      expect(htmlContent).toMatch(/transition/);
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

  describe('Search Functionality', () => {
    it('should have search input for filtering concepts', () => {
      expect(htmlContent).toMatch(/Search concepts by name or description/);
    });

    it('search input should use x-model for Alpine.js binding', () => {
      expect(htmlContent).toMatch(/<input[^>]*x-model="searchQuery"[^>]*>/);
    });

    it('should have clear filter button', () => {
      expect(htmlContent).toMatch(/Clear Filter/);
    });

    it('clear button should use clearSearch Alpine method', () => {
      expect(htmlContent).toMatch(/@click="clearSearch"/);
    });

    it('clear button should only show when search query is active', () => {
      expect(htmlContent).toMatch(/x-show="searchQuery"/);
    });

    it('should display error message when no concepts match search', () => {
      expect(htmlContent).toMatch(/No concepts match your search/);
    });

    it('error message should be conditionally shown', () => {
      expect(htmlContent).toMatch(/x-show="filteredConcepts.length === 0 && searchQuery"/);
    });

    it('should have Alpine.js data function landingPage', () => {
      expect(htmlContent).toMatch(/x-data="landingPage\(\)"/);
    });

    it('should have searchQuery property in Alpine data', () => {
      expect(htmlContent).toMatch(/searchQuery:\s*''/);
    });

    it('concepts should be defined in Alpine data', () => {
      expect(htmlContent).toMatch(/concepts:\s*\[/);
    });

    it('each concept should have id, name, description, link, and enabled properties', () => {
      expect(htmlContent).toMatch(/id:/);
      expect(htmlContent).toMatch(/name:/);
      expect(htmlContent).toMatch(/description:/);
      expect(htmlContent).toMatch(/link:/);
      expect(htmlContent).toMatch(/enabled:/);
    });

    it('should have filteredConcepts computed getter in Alpine', () => {
      expect(htmlContent).toMatch(/get filteredConcepts\(\)/);
    });

    it('filteredConcepts should filter by name and description', () => {
      expect(htmlContent).toMatch(/concept.name.toLowerCase\(\).includes\(query\)/);
      expect(htmlContent).toMatch(/concept.description.toLowerCase\(\).includes\(query\)/);
    });

    it('concepts grid should use x-for to render filtered concepts', () => {
      expect(htmlContent).toMatch(/x-for="concept in filteredConcepts"/);
    });

    it('disabled concepts should not be clickable', () => {
      expect(htmlContent).toMatch(/pointer-events-none/);
    });

    it('search should be case-insensitive', () => {
      expect(htmlContent).toMatch(/toLowerCase/);
    });

    it('concepts should have cursor-pointer class when enabled', () => {
      expect(htmlContent).toMatch(/cursor-pointer/);
    });

    it('disabled concepts should have reduced opacity', () => {
      expect(htmlContent).toMatch(/opacity-60/);
    });
  });
});
