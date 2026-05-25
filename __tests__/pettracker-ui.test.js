/**
 * PetTracker UI Tests
 * Tests for pet listing, search, and pagination features
 */

const fs = require('fs');
const path = require('path');

describe('PetTracker UI (concepts/pettracker.html)', () => {
  let htmlContent;

  beforeAll(() => {
    const htmlPath = path.join(__dirname, '..', 'concepts', 'pettracker.html');
    htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  });

  describe('Pet Listing Section', () => {
    it('should have pet listing section with "Registered Pets" heading', () => {
      expect(htmlContent).toMatch(/Registered Pets/);
    });

    it('should display message when no pets registered', () => {
      expect(htmlContent).toMatch(/No pets registered yet/);
    });

    it('should use x-for loop to render filtered pets', () => {
      expect(htmlContent).toMatch(/x-for="pet in filteredAndPaginatedPets"/);
    });

    it('should display pet name', () => {
      expect(htmlContent).toMatch(/x-text="pet.name"/);
    });

    it('should display pet species and breed', () => {
      expect(htmlContent).toMatch(/\$\{pet.species\}/);
      expect(htmlContent).toMatch(/pet.breed/);
    });

    it('should display pet owner address', () => {
      expect(htmlContent).toMatch(/pet.owner.substring/);
    });

    it('should show management rights when applicable', () => {
      expect(htmlContent).toMatch(/You have management rights/);
    });

    it('should display SPL token mint address', () => {
      expect(htmlContent).toMatch(/Mint:/);
      expect(htmlContent).toMatch(/pet.mint_address/);
    });

    it('should have View Details, Edit, and Delete buttons', () => {
      expect(htmlContent).toMatch(/View Details/);
      expect(htmlContent).toMatch(/Edit.*Delete/s);
    });

    it('should show read-only badge for non-owned pets', () => {
      expect(htmlContent).toMatch(/\(read-only\)/);
    });
  });

  describe('Pet Search Functionality', () => {
    it('should have search input for pets', () => {
      expect(htmlContent).toMatch(/Search pets by name, species, breed, or owner/);
    });

    it('search input should bind to petSearchQuery', () => {
      expect(htmlContent).toMatch(/x-model="petSearchQuery"/);
    });

    it('should have Clear Search button', () => {
      expect(htmlContent).toMatch(/Clear Search/);
    });

    it('clear search button should be conditional', () => {
      expect(htmlContent).toMatch(/x-show="petSearchQuery"/);
    });

    it('clear search should call clearPetSearch method', () => {
      expect(htmlContent).toMatch(/@click="clearPetSearch"/);
    });

    it('should display no-match message when search finds nothing', () => {
      expect(htmlContent).toMatch(/No pets match your search/);
    });

    it('should show match count when search is active', () => {
      expect(htmlContent).toMatch(/Found.*pet\(s\) matching your search/);
    });

    it('should have clearPetSearch method in Alpine data', () => {
      expect(htmlContent).toMatch(/clearPetSearch\(\)\s*\{/);
    });

    it('clearPetSearch should reset search query and pagination', () => {
      expect(htmlContent).toMatch(/clearPetSearch.*\{[\s\S]*?petSearchQuery.*''[\s\S]*?displayedPetsCount.*12/);
    });

    it('should have petSearchQuery property in Alpine data', () => {
      expect(htmlContent).toMatch(/petSearchQuery:\s*''/);
    });
  });

  describe('Pet Pagination', () => {
    it('should have displayedPetsCount property set to 12', () => {
      expect(htmlContent).toMatch(/displayedPetsCount:\s*12/);
    });

    it('should have filteredAndPaginatedPets computed getter', () => {
      expect(htmlContent).toMatch(/get filteredAndPaginatedPets\(\)/);
    });

    it('should filter pets based on search query', () => {
      expect(htmlContent).toMatch(/pet.name.toLowerCase\(\).includes\(query\)/);
      expect(htmlContent).toMatch(/pet.species.toLowerCase\(\).includes\(query\)/);
    });

    it('should limit display to displayedPetsCount', () => {
      expect(htmlContent).toMatch(/slice\(0, this.displayedPetsCount\)/);
    });

    it('should have Load More button', () => {
      expect(htmlContent).toMatch(/Load More/);
    });

    it('Load More button should only show when needed', () => {
      expect(htmlContent).toMatch(/x-show="displayedPetsCount < totalFilteredPets"/);
    });

    it('should have loadMorePets method', () => {
      expect(htmlContent).toMatch(/loadMorePets\(\)\s*\{/);
    });

    it('loadMorePets should increment by 12', () => {
      expect(htmlContent).toMatch(/loadMorePets\(\)[\s\S]*?displayedPetsCount[\s\S]*?\+=/);
    });

    it('should have Collapse button', () => {
      expect(htmlContent).toMatch(/Collapse/);
    });

    it('Collapse button should only show when showing more than 12', () => {
      expect(htmlContent).toMatch(/x-show="displayedPetsCount > 12"/);
    });

    it('should have collapsePets method', () => {
      expect(htmlContent).toMatch(/collapsePets\(\)\s*\{/);
    });

    it('collapsePets should reset to 12', () => {
      expect(htmlContent).toMatch(/collapsePets\(\)[\s\S]*?displayedPetsCount[\s\S]*?=[\s\S]*?12/);
    });

    it('should have totalFilteredPets computed getter', () => {
      expect(htmlContent).toMatch(/get totalFilteredPets\(\)/);
    });

    it('pagination controls should be conditionally visible', () => {
      expect(htmlContent).toMatch(/x-show="filteredAndPaginatedPets.length > 0 && \(displayedPetsCount < totalFilteredPets || displayedPetsCount > 12\)"/);
    });
  });

  describe('Pet Listing Section Order', () => {
    it('pet listing should come before registration form', () => {
      const listingIndex = htmlContent.indexOf('Registered Pets');
      const registrationIndex = htmlContent.indexOf('Register a New Pet');
      expect(listingIndex).toBeLessThan(registrationIndex);
    });
  });

  describe('Alpine Data Properties', () => {
    it('should have pets array', () => {
      expect(htmlContent).toMatch(/pets:\s*\[\]/);
    });

    it('should have petSearchQuery initialized to empty', () => {
      expect(htmlContent).toMatch(/petSearchQuery:\s*''/);
    });

    it('should have displayedPetsCount initialized to 12', () => {
      expect(htmlContent).toMatch(/displayedPetsCount:\s*12/);
    });
  });

  describe('Refresh Button', () => {
    it('should have refresh list button', () => {
      expect(htmlContent).toMatch(/Refresh List/);
    });

    it('refresh button should call loadPets method', () => {
      expect(htmlContent).toMatch(/@click="loadPets".*Refresh List/);
    });
  });

  describe('Search Query Integration', () => {
    it('should match against pet name', () => {
      expect(htmlContent).toMatch(/pet.name.toLowerCase\(\).includes\(query\)/);
    });

    it('should match against pet species', () => {
      expect(htmlContent).toMatch(/pet.species.toLowerCase\(\).includes\(query\)/);
    });

    it('should match against pet breed', () => {
      expect(htmlContent).toMatch(/pet.breed.*toLowerCase\(\).includes\(query\)/);
    });

    it('should match against pet owner', () => {
      expect(htmlContent).toMatch(/pet.owner.toLowerCase\(\).includes\(query\)/);
    });

    it('searches should be case-insensitive', () => {
      expect(htmlContent).toMatch(/toLowerCase/);
    });
  });

  describe('Registration Form Placeholders', () => {
    it('Pet Name field should have placeholder', () => {
      expect(htmlContent).toMatch(/placeholder="e\.g\., Max, Bella, Charlie"/);
    });

    it('Species field should have placeholder', () => {
      expect(htmlContent).toMatch(/placeholder="e\.g\., Dog, Cat, Bird, Rabbit"/);
    });

    it('Breed field should have placeholder', () => {
      expect(htmlContent).toMatch(/placeholder="e\.g\., Golden Retriever, Siamese Cat"/);
    });

    it('Age field should have placeholder', () => {
      expect(htmlContent).toMatch(/placeholder="e\.g\., 3, 5, 7"/);
    });

    it('Owner wallet field should have placeholder', () => {
      expect(htmlContent).toMatch(/placeholder="Enter Solana address"/);
    });

    it('all form inputs should have placeholders', () => {
      const placeholderCount = (htmlContent.match(/placeholder="/g) || []).length;
      expect(placeholderCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Veterinary Authorization Form', () => {
    it('should have authorization form section', () => {
      expect(htmlContent).toMatch(/Authorize a Veterinary/);
    });

    it('should have pet selector dropdown', () => {
      expect(htmlContent).toMatch(/Select Pet/);
      expect(htmlContent).toMatch(/selectedPetForVetAuth/);
    });

    it('should have vet address input field', () => {
      expect(htmlContent).toMatch(/Veterinary Solana Address/);
      expect(htmlContent).toMatch(/newVetAddress/);
    });

    it('should have authorized vets list display', () => {
      expect(htmlContent).toMatch(/Authorized Veterinaries:/);
      expect(htmlContent).toMatch(/No veterinaries authorized yet/);
    });

    it('should have submit button for authorization', () => {
      expect(htmlContent).toMatch(/Authorize Veterinary/);
      expect(htmlContent).toMatch(/submitAuthorizeVet/);
    });

    it('should have loading state indicator', () => {
      expect(htmlContent).toMatch(/isAuthorizingVet/);
    });

    it('should have scrollable form with id', () => {
      expect(htmlContent).toMatch(/id="auth-form"/);
    });
  });

  describe('Pet Listing - Authorized Vets Display', () => {
    it('should show authorized vets section on pet cards', () => {
      expect(htmlContent).toMatch(/Veterinaries Authorized:/);
    });

    it('should show warning when no vets authorized', () => {
      expect(htmlContent).toMatch(/No veterinary authorized/);
    });

    it('should have clickable warning button', () => {
      expect(htmlContent).toMatch(/scrollToAuthForm/);
    });
  });

  describe('Alpine.js Methods for Authorization', () => {
    it('should have getAuthorizedVets method defined', () => {
      expect(htmlContent).toMatch(/getAuthorizedVets/);
    });

    it('should have submitAuthorizeVet method', () => {
      expect(htmlContent).toMatch(/async submitAuthorizeVet/);
    });

    it('should have Solana address validation', () => {
      expect(htmlContent).toMatch(/solanaAddressRegex/);
    });

    it('should have scrollToAuthForm method', () => {
      expect(htmlContent).toMatch(/scrollToAuthForm/);
    });

    it('should clear form after authorization', () => {
      expect(htmlContent).toMatch(/this\.newVetAddress = '';/);
    });
  });

  describe('Data Properties for Authorization', () => {
    it('should initialize selectedPetForVetAuth', () => {
      expect(htmlContent).toMatch(/selectedPetForVetAuth:/);
    });

    it('should initialize newVetAddress', () => {
      expect(htmlContent).toMatch(/newVetAddress:/);
    });

    it('should initialize isAuthorizingVet', () => {
      expect(htmlContent).toMatch(/isAuthorizingVet:/);
    });

    it('should initialize vetAuthMessage', () => {
      expect(htmlContent).toMatch(/vetAuthMessage:/);
    });
  });

  describe('API Integration for Authorization', () => {
    it('should call authorize-vet endpoint', () => {
      expect(htmlContent).toMatch(/authorize-vet/);
    });

    it('should send POST request', () => {
      expect(htmlContent).toMatch(/method:.*POST/);
    });

    it('should parse SAS credential response', () => {
      expect(htmlContent).toMatch(/sasCredential/);
    });

    it('should handle form submission', () => {
      expect(htmlContent).toMatch(/petId/);
      expect(htmlContent).toMatch(/ownerAddress/);
      expect(htmlContent).toMatch(/vetAddress/);
    });
  });

  describe('Authorization Form Validation', () => {
    it('should disable submit button when empty', () => {
      expect(htmlContent).toMatch(/isAuthorizingVet.*selectedPetForVetAuth.*newVetAddress/);
    });

    it('should show validation help text', () => {
      expect(htmlContent).toMatch(/32-44.*base58/);
    });
  });
});

