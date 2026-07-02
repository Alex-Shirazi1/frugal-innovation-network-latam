import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'
import worldData from '../../data/countries-110m.json'

/**
 * Real country geometry (Natural Earth 110m via world-atlas), rendered with a
 * Mercator projection — the same mental model as the Google My Maps embed on
 * the current production site, rebuilt as a fully local, style-able canvas.
 */
interface CountryProps {
  name: string
}

const topology = worldData as unknown as Topology<{
  countries: GeometryCollection<CountryProps>
}>

const world = feature(topology, topology.objects.countries) as FeatureCollection<
  Geometry,
  CountryProps
>

// Antarctica distorts a fitted Mercator frame and adds nothing here.
const countries = world.features.filter((f) => f.properties.name !== 'Antarctica')
const drawable: FeatureCollection<Geometry, CountryProps> = {
  type: 'FeatureCollection',
  features: countries,
}

export const MAP_W = 1600

const projection = geoMercator().fitWidth(MAP_W, drawable)
const pathGenerator = geoPath(projection)

const bounds = pathGenerator.bounds(drawable)
export const MAP_H = Math.ceil(bounds[1][1])

/** Countries where the network has member institutions — tinted on the map. */
const memberCountryNames = new Set([
  'Mexico', 'Colombia', 'Argentina', 'El Salvador', 'Nicaragua',
  'United States of America', 'Peru', 'Chile', 'Brazil', 'Costa Rica',
  'Spain', 'France', 'Finland', 'Switzerland',
])

export interface CountryPath {
  name: string
  d: string
  isMember: boolean
}

export const countryPaths: CountryPath[] = countries
  .map((f) => ({
    name: f.properties.name,
    d: pathGenerator(f) ?? '',
    isMember: memberCountryNames.has(f.properties.name),
  }))
  .filter((c) => c.d !== '')

/** Project [latitude, longitude] into map canvas coordinates. */
export function projectLatLon(lat: number, lon: number): [number, number] {
  const point = projection([lon, lat])
  return point ?? [0, 0]
}
