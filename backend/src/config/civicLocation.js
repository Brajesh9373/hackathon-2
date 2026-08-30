const location = require('../../../shared/civic-location.json');

function canonicalCivicLocation() {
  return {
    name: location.name,
    address: location.address,
    district: location.district,
    area: location.area,
    ward: location.ward,
    zone: location.zone,
    pincode: location.pincode,
    coords: { ...location.coords },
  };
}

module.exports = { SANJIVANI_LOCATION: location, canonicalCivicLocation };
