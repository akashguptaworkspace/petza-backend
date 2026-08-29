import {
  AvailablePetStatuses,
  PetListingStatus,
  PubliclyVisiblePetStatuses,
} from '../src/config/constants.js';

describe('public pet catalogue statuses', () => {
  it('discovers every listing except an explicitly archived one', () => {
    expect(PubliclyVisiblePetStatuses).toEqual([
      PetListingStatus.AVAILABLE,
      PetListingStatus.RESERVED,
      PetListingStatus.SOLD,
      PetListingStatus.UNAVAILABLE,
    ]);
    expect(PubliclyVisiblePetStatuses).not.toContain(PetListingStatus.ARCHIVED);
  });

  it('keeps store available-pet counts limited to actionable listings', () => {
    expect(AvailablePetStatuses).toEqual([
      PetListingStatus.AVAILABLE,
      PetListingStatus.RESERVED,
    ]);
  });
});
