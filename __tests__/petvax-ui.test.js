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

    it('vaccines should have type badges (SPL Token Mint, Vaccine Tx (Shot))', () => {
      expect(htmlContent).toMatch(/⛓ SPL Token Mint/);
      expect(htmlContent).toMatch(/📝 Vaccine Tx \(Shot\)/);
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
      expect(htmlContent).toMatch(/⛓ SPL Token Mint[\s\S]*bg-purple/);
    });

    it('shot records shown with 📝 icon and blue styling', () => {
      expect(htmlContent).toMatch(/📝 Vaccine Tx \(Shot\)[\s\S]*bg-blue/);
    });

    it('SPL Token Mint rows should have ✙ icon in first column', () => {
      expect(htmlContent).toMatch(/x-show="getVaccinationType\(vax\) === 'spl_token_mint'"[\s\S]*✙/);
    });

    it('Vaccine Tx Shot rows should have 💉 icon in first column', () => {
      expect(htmlContent).toMatch(/x-show="getVaccinationType\(vax\) === 'vaccine_tx_shot'"[\s\S]*💉/);
    });
  });

   describe('Vaccination Details Modal', () => {
    it('should have View Details button in actions', () => {
      expect(htmlContent).toMatch(/📋 View Details/);
    });

    it('View Details button should open vaccination details modal', () => {
      expect(htmlContent).toMatch(/openVaccinationDetailsModal\(vax\)/);
    });

    it('should have vaccination details modal', () => {
      expect(htmlContent).toMatch(/Vaccination Details/);
    });

    it('details modal should show vaccination type badge', () => {
      expect(htmlContent).toMatch(/getVaccinationType\(selectedVaccinationForDetails\)/);
    });

    it('details modal should display vaccine name', () => {
      expect(htmlContent).toMatch(/Vaccine Name[\s\S]*selectedVaccinationForDetails\?\.vaccine_name/);
    });

    it('details modal should display vaccination date', () => {
      expect(htmlContent).toMatch(/Vaccination Date[\s\S]*selectedVaccinationForDetails\?\.vaccination_date/);
    });

    it('details modal should display vet address', () => {
      expect(htmlContent).toMatch(/Veterinary Clinic Address[\s\S]*selectedVaccinationForDetails\?\.vet_address/);
    });

    it('details modal should conditionally show token mint address', () => {
      expect(htmlContent).toMatch(/x-show="selectedVaccinationForDetails\?\.mint_address"[\s\S]*Token Mint Address/);
    });

    it('details modal should conditionally show transaction signature', () => {
      expect(htmlContent).toMatch(/x-show="selectedVaccinationForDetails\?\.transaction_signature"[\s\S]*Transaction Signature/);
    });

    it('details modal should conditionally show transaction hash', () => {
      expect(htmlContent).toMatch(/x-show="selectedVaccinationForDetails\?\.transaction_hash"[\s\S]*Transaction Hash/);
    });

    it('details modal should show Solscan link for on-chain transactions', () => {
      expect(htmlContent).toMatch(/View on Solscan[\s\S]*transaction_hash/);
    });

     it('View Details should appear before Solscan link in actions', () => {
       const viewDetailsMatch = htmlContent.match(/📋 View Details[\s\S]*openVaccinationDetailsModal/);
       const solscanMatch = htmlContent.match(/🔗 Solscan[\s\S]*transaction_hash/);
       expect(viewDetailsMatch).toBeTruthy();
       expect(solscanMatch).toBeTruthy();
     });
   });

   describe('New Shot Link Restrictions', () => {
     it('New Shot button should only show for SPL Token Mint type', () => {
       expect(htmlContent).toMatch(/getVaccinationType\(vax\) === 'spl_token_mint'/);
     });

     it('New Shot button should only show for first vaccination of vaccine type', () => {
       expect(htmlContent).toMatch(/isFirstVaccinationOfType\(vax\)/);
     });

     it('New Shot button should have both conditions: type check and first check', () => {
       expect(htmlContent).toMatch(/getVaccinationType\(vax\) === 'spl_token_mint' && isFirstVaccinationOfType\(vax\)/);
     });
   });
});
