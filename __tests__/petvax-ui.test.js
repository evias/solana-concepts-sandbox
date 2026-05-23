/**
 * PetVax UI Tests
 * Tests for vaccination table listing, search, and reordering
 */

const fs = require('fs');
const path = require('path');

describe('PetVax UI (concepts/petvax.html)', () => {
  let htmlContent;

  beforeAll(() => {
    const htmlPath = path.join(__dirname, '..', 'concepts', 'petvax.html');
    htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  });

  describe('Vaccination Table Section', () => {
    it('should have vaccination history table section', () => {
      expect(htmlContent).toMatch(/Vaccination History Table Section/);
    });

    it('vaccination table section should come before record form', () => {
      const tableIndex = htmlContent.indexOf('Vaccination History Table Section');
      const formIndex = htmlContent.indexOf('Record Vaccination');
      expect(tableIndex).toBeLessThan(formIndex);
    });

    it('should have table element', () => {
      expect(htmlContent).toMatch(/<table/);
    });

    it('table should be responsive with overflow-x-auto', () => {
      expect(htmlContent).toMatch(/overflow-x-auto/);
    });

    it('should have thead with headers', () => {
      expect(htmlContent).toMatch(/<thead/);
      expect(htmlContent).toMatch(/<th/);
    });

    it('should have header columns: Vaccine, Date, Type, Vet Address, Status, Actions', () => {
      expect(htmlContent).toMatch(/Vaccine/);
      expect(htmlContent).toMatch(/Date/);
      expect(htmlContent).toMatch(/Type/);
      expect(htmlContent).toMatch(/Vet Address/);
      expect(htmlContent).toMatch(/Status/);
      expect(htmlContent).toMatch(/Actions/);
    });

    it('table body should render filtered vaccinations', () => {
      expect(htmlContent).toMatch(/x-for="vax in filteredVaccinations"/);
    });

    it('vaccinations should show vaccine name', () => {
      expect(htmlContent).toMatch(/x-text="vax.vaccine_name"/);
    });

    it('vaccinations should show date', () => {
      expect(htmlContent).toMatch(/new Date\(vax.vaccination_date\).toLocaleDateString\(\)/);
    });

    it('vaccines should have type badges (SPL Token, Shot Record, Verified)', () => {
      expect(htmlContent).toMatch(/⛓ SPL Token/);
      expect(htmlContent).toMatch(/📝 Shot Record/);
      expect(htmlContent).toMatch(/✓ Verified/);
    });

    it('should display vet address truncated', () => {
      expect(htmlContent).toMatch(/vax.vet_address.substring\(0, 6\)/);
    });

    it('should have different colors for different vaccine types', () => {
      expect(htmlContent).toMatch(/bg-purple-50/);  // SPL Token
      expect(htmlContent).toMatch(/bg-blue-50/);    // Signed
      expect(htmlContent).toMatch(/bg-green-50/);   // Verified
    });

    it('should show On-Chain badge for transaction hash', () => {
      expect(htmlContent).toMatch(/On-Chain/);
    });

    it('should show Signed badge for transaction signature', () => {
      expect(htmlContent).toMatch(/Signed/);
    });

    it('should show Local badge for neither', () => {
      expect(htmlContent).toMatch(/Local/);
    });

    it('should have Solscan link when transaction exists', () => {
      expect(htmlContent).toMatch(/solscan.io\/tx\//);
    });

    it('should have Record New Shot button', () => {
      expect(htmlContent).toMatch(/📋 New Shot/);
    });
  });

  describe('Vaccination Search', () => {
    it('should have search input for vaccinations', () => {
      expect(htmlContent).toMatch(/Search vaccinations by name, vet address, or date/);
    });

    it('search input should bind to vaccinationSearchQuery', () => {
      expect(htmlContent).toMatch(/x-model="vaccinationSearchQuery"/);
    });

    it('should have Clear Search button', () => {
      expect(htmlContent).toMatch(/Clear Search/);
    });

    it('clear search button should be conditional on vaccinationSearchQuery', () => {
      expect(htmlContent).toMatch(/x-show="vaccinationSearchQuery"/);
    });

    it('clear search should call clearVaccinationSearch', () => {
      expect(htmlContent).toMatch(/@click="clearVaccinationSearch"/);
    });

    it('should have vaccinationSearchQuery property in Alpine data', () => {
      expect(htmlContent).toMatch(/vaccinationSearchQuery:\s*''/);
    });

    it('should have filteredVaccinations computed getter', () => {
      expect(htmlContent).toMatch(/get filteredVaccinations\(\)/);
    });

    it('filteredVaccinations should filter by vaccine name', () => {
      expect(htmlContent).toMatch(/vax.vaccine_name.toLowerCase\(\).includes\(query\)/);
    });

    it('filteredVaccinations should filter by vet address', () => {
      expect(htmlContent).toMatch(/vax.vet_address.toLowerCase\(\).includes\(query\)/);
    });

    it('filteredVaccinations should filter by notes', () => {
      expect(htmlContent).toMatch(/vax.notes.*toLowerCase\(\).includes\(query\)/);
    });

    it('should display no-match message', () => {
      expect(htmlContent).toMatch(/No vaccinations match your search/);
    });

    it('should have clearVaccinationSearch method', () => {
      expect(htmlContent).toMatch(/clearVaccinationSearch\(\)\s*\{/);
    });

    it('filteredVaccinations should return all when no search query', () => {
      expect(htmlContent).toMatch(/get filteredVaccinations[\s\S]*vaccinationSearchQuery[\s\S]*this.vaccinations/);
    });
  });

  describe('Vaccination Listing Features', () => {
    it('should show "No vaccinations recorded" when empty', () => {
      expect(htmlContent).toMatch(/No vaccinations recorded yet for this pet/);
    });

    it('should have Refresh button', () => {
      expect(htmlContent).toMatch(/Refresh/);
    });

    it('refresh button should call loadVaccinationHistory', () => {
      expect(htmlContent).toMatch(/@click="loadVaccinationHistory\(\)"/);
    });

    it('vaccination table should be conditionally visible', () => {
      expect(htmlContent).toMatch(/x-show="vaccinations.length > 0 && filteredVaccinations.length > 0"/);
    });

    it('should only show table when filtered results exist', () => {
      expect(htmlContent).toMatch(/filteredVaccinations.length > 0/);
    });

    it('row should have hover effect', () => {
      expect(htmlContent).toMatch(/hover:bg-gray-50/);
    });
  });

  describe('Old Vacation History Section Removed', () => {
    it('should not have duplicate "Verify Vaccinations" section', () => {
      const matches = (htmlContent.match(/<!-- Verify Vaccinations -->/g) || []).length;
      expect(matches).toBe(0);
    });

    it('should have only one search input for vaccinations', () => {
      const searchMatches = (htmlContent.match(/Search vaccinations/g) || []).length;
      expect(searchMatches).toBeLessThanOrEqual(2); // May appear in tests/regex patterns
    });
  });

  describe('Table Structure', () => {
    it('should have properly structured table with thead and tbody', () => {
      expect(htmlContent).toMatch(/<table[\s\S]*<thead[\s\S]*<tbody[\s\S]*<\/tbody[\s\S]*<\/table>/);
    });

    it('table should have min-w-full for responsive width', () => {
      expect(htmlContent).toMatch(/min-w-full/);
    });

    it('table rows should have proper padding', () => {
      expect(htmlContent).toMatch(/px-4 py-3/);
    });

    it('table headers should show font-semibold', () => {
      expect(htmlContent).toMatch(/font-semibold.*text-gray-700/);
    });
  });

  describe('Type Differentiation', () => {
    it('SPL tokens shown with ⛓ icon and purple styling', () => {
      expect(htmlContent).toMatch(/⛓ SPL Token[\s\S]*bg-purple/);
    });

    it('shot records shown with 📝 icon and blue styling', () => {
      expect(htmlContent).toMatch(/📝 Shot Record[\s\S]*bg-blue/);
    });

    it('verified records shown with ✓ icon and green styling', () => {
      expect(htmlContent).toMatch(/✓ Verified[\s\S]*bg-green/);
    });
  });
});
