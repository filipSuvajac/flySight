import type { EbirdObservation } from "../types";

export type ObservationFilters = {
  species: string;
  location: string;
  date: string;
  source: string;
};

export const emptyObservationFilters: ObservationFilters = {
  species: "",
  location: "",
  date: "",
  source: ""
};

export function filterEbirdObservations(
  observations: EbirdObservation[],
  filters: ObservationFilters
): EbirdObservation[] {
  const species = filters.species.trim().toLowerCase();
  const location = filters.location.trim().toLowerCase();
  const date = filters.date;
  const source = filters.source.trim().toLowerCase();

  return observations.filter((observation) => {
    const observedDate = observation.observedAt.slice(0, 10);

    const speciesMatch =
      !species ||
      observation.slovenianName.toLowerCase().includes(species) ||
      observation.commonName.toLowerCase().includes(species) ||
      observation.scientificName.toLowerCase().includes(species) ||
      observation.speciesCode.toLowerCase().includes(species);

    const locationMatch =
      !location ||
      observation.city.toLowerCase().includes(location) ||
      observation.locationName.toLowerCase().includes(location);

    const dateMatch = !date || observedDate === date;
    const sourceMatch = !source || "ebird".includes(source);

    return speciesMatch && locationMatch && dateMatch && sourceMatch;
  });
}
