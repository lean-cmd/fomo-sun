// ============================================================
// FOMO Sun - Core Types
// ============================================================

/** A curated destination that can be recommended */
export interface Destination {
  id: string
  name: string
  region: string
  country: 'CH' | 'DE' | 'FR'
  lat: number
  lon: number
  altitude_m: number
  types: DestinationType[]
  plan_template: string
  webcam_url?: string
  maps_url?: string
  sbb_url?: string
  meteoswiss_point_id?: string // CH destinations
  description?: string
}

export type DestinationType = 'nature' | 'viewpoint' | 'town' | 'lake' | 'family' | 'food' | 'mountain' | 'thermal'

export type TravelMode = 'car' | 'train' | 'both'

export type Confidence = 'high' | 'medium' | 'low' | 'uncertain'

/** Sun score for a destination at a point in time */
export interface SunScore {
  score: number          // 0-1
  confidence: Confidence
  sunshine_forecast_min: number  // predicted sunshine minutes in next 3h
  low_cloud_cover_pct: number   // predicted low cloud cover %
  altitude_bonus: number         // 0-1 bonus for altitude during inversions
  data_freshness: string         // ISO timestamp
}

/** Travel routing result */
export interface TravelResult {
  mode: 'car' | 'train'
  duration_min: number
  distance_km?: number
  changes?: number       // PT only
  ga_included?: boolean  // PT only
  departure_time?: string
}

/** Sunshine timeline segment for forecast bars */
export type SkyCondition = 'sun' | 'partial' | 'cloud' | 'night'

export interface TimelineSegment {
  condition: SkyCondition
  pct: number  // percentage width of the bar
}

export interface SunTimeline {
  today: TimelineSegment[]
  tomorrow: TimelineSegment[]
}

/** A single escape recommendation */
export interface EscapeResult {
  rank: number
  destination: Destination
  sun_score: SunScore
  conditions: string
  travel: {
    car?: TravelResult
    train?: TravelResult
  }
  plan: string[]
  links: {
    google_maps?: string
    sbb?: string
    webcam?: string
  }
  sun_timeline: SunTimeline
}

/** Full API response */
export interface SunnyEscapesResponse {
  _meta: {
    request_id: string
    origin: {
      name: string
      lat: number
      lon: number
    }
    generated_at: string
    weather_data_freshness: string
    attribution: string[]
  }
  origin_conditions: {
    description: string
    sun_score: number
  }
  max_sun_hours_today: number  // FOMO stat: max available sun hours above the fog
  escapes: EscapeResult[]
}

/** User preferences (stored in localStorage) */
export interface UserPreferences {
  default_origin?: {
    name: string
    lat: number
    lon: number
  }
  max_travel_h: number
  travel_mode: TravelMode
  has_ga: boolean
  preferred_types: DestinationType[]
}

/** API query parameters */
export interface SunnyEscapesQuery {
  lat: number
  lon: number
  max_travel_h: number
  mode: TravelMode
  ga?: boolean
  types?: DestinationType[]
  limit?: number
}
