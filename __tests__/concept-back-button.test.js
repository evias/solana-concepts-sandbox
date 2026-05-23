/**
 * Concept Back Button Tests
 * Tests for back buttons in all concept pages
 */

const fs = require('fs');
const path = require('path');

describe('Concept Pages - Back Button', () => {
  const conceptFiles = ['pettracker.html', 'petvax.html'];
  
  conceptFiles.forEach(file => {
    describe(`${file}`, () => {
      let htmlContent;

      beforeAll(() => {
        const htmlPath = path.join(__dirname, '..', 'concepts', file);
        htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      });

      it('should have a header element', () => {
        expect(htmlContent).toMatch(/<header/);
      });

      it('should have flex layout with buttons on the right', () => {
        expect(htmlContent).toMatch(/flex justify-between/);
      });

      it('should have button group with gap-2', () => {
        expect(htmlContent).toMatch(/flex.*gap-2/);
      });

      it('should have back button', () => {
        expect(htmlContent).toMatch(/← Back/);
      });

      it('back button should link to home page', () => {
        expect(htmlContent).toMatch(/<a[^>]*href="\/"[^>]*>[\s\S]*?← Back/);
      });

      it('back button should have gray styling', () => {
        expect(htmlContent).toMatch(/bg-gray-600.*text-white/);
      });

      it('back button should have hover effect', () => {
        expect(htmlContent).toMatch(/hover:bg-gray-700/);
      });

      it('back button should have proper padding', () => {
        expect(htmlContent).toMatch(/px-4 py-2/);
      });

      it('back button should have rounded corners', () => {
        expect(htmlContent).toMatch(/rounded-md/);
      });

      it('should have documentation button', () => {
        expect(htmlContent).toMatch(/📚 Documentation/);
      });

      it('back and documentation buttons should be in same container', () => {
        expect(htmlContent).toMatch(/<div[^>]*class="[^"]*flex[^"]*gap-2[^"]*">[\s\S]*?← Back[\s\S]*?📚 Documentation/);
      });

      it('documentation button should follow back button', () => {
        const backIndex = htmlContent.indexOf('← Back');
        const docIndex = htmlContent.indexOf('📚 Documentation');
        expect(backIndex).toBeLessThan(docIndex);
      });

      it('back button should have no target="_blank"', () => {
        const backButtonPattern = /<a[^>]*href="\/"[^>]*>[\s\S]*?← Back[\s\S]*?<\/a>/;
        const backButtonMatch = htmlContent.match(backButtonPattern);
        if (backButtonMatch) {
          expect(backButtonMatch[0]).not.toMatch(/target="_blank"/);
        }
      });
    });
  });

  describe('All concepts have consistent back button styling', () => {
    it('all concept files should exist', () => {
      conceptFiles.forEach(file => {
        const htmlPath = path.join(__dirname, '..', 'concepts', file);
        expect(() => fs.readFileSync(htmlPath, 'utf-8')).not.toThrow();
      });
    });

    it('all concept files should have back button with same styling', () => {
      const backButtonPattern = /← Back/;
      const grayStylePattern = /bg-gray-600/;
      conceptFiles.forEach(file => {
        const htmlPath = path.join(__dirname, '..', 'concepts', file);
        const content = fs.readFileSync(htmlPath, 'utf-8');
        expect(content).toMatch(backButtonPattern);
        expect(content).toMatch(grayStylePattern);
      });
    });
  });
});
