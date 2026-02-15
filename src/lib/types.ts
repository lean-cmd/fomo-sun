// FOMO Sun - Core Types

export interface Destination {
  id: string; name: string; region: string; country: 'CH' | 'DE' | 'FR'
  lat: number; lon: number; altitude_m: number; types: DestinationType[]
  plan_template: string; maps_name: string; sbb_name?: string | null
  trip_plan?: {
    arrival: string
    do: string
    eat: string
    pro_tip?: string
  }
  webcam_url?: string; maps_url?: string; sbb_url?: string
  meteoswiss_point_id?: string; description?: string
}

export type DestinationType = 'nature' | 'viewpoint' | 'town' | 'lake' | 'family' | 'food' | 'mountain' | 'thermal'
export type TravelMode = 'car' | 'train' | 'both'
export type Confidence = 'high' | 'medium' | 'low' | 'uncertain'
export type SkyCondition = 'sun' | 'partial' | 'cloud' | 'night'

export interface ScoreBreakdown {
  sunshine_pct: number
  cloud_pct: number
  altitude_bonus_pct: number
  gain_pct: number
}

export interface SunScore {
  score: number; confidence: Confidence
  sunshine_forecast_min: number; low_cloud_cover_pct: number
  altitude_bonus: number; data_freshness: string
  score_breakdown: ScoreBreakdown
}

export interface TravelResult {
  mode: 'car' | 'train'; duration_min: number
  distance_km?: number; changes?: number; ga_included?: boolean; departure_time?: string
}

export interface TimelineSegment { condition: SkyCondition; pct: number }
export interface SunTimeline { today: TimelineSegment[]; tomorrow: TimelineSegment[] }
export interface DaylightWindow { start_hour: number; end_hour: number }

export interface EscapeResult {
  rank: number; destination: Destination; sun_score: SunScore
  conditions: string  // human-friendly with comparison
  net_sun_min: number // sunshine minus round-trip travel time
  weather_now: { summary: string; temp_c: number }
  travel: { car?: TravelResult; train?: TravelResult }
  plan: string[]; links: { google_maps?: string; sbb?: string; webcam?: string }
  sun_timeline: SunTimeline
  tomorrow_sun_hours: number // per-destination tomorrow forecast
  admin_hourly?: Array<{
    time: string
    sunshine_min: number
    cloud_cover_pct: number
    low_cloud_cover_pct: number
    temperature_c: number
    relative_humidity_pct: number
    wind_speed_kmh: number
  }>
}

export interface SunnyEscapesResponse {
  _meta: {
    request_id: string
    origin: { name: string; lat: number; lon: number }
    generated_at: string; weather_data_freshness: string
    attribution: string[]; demo_mode: boolean
    trip_span?: 'daytrip' | 'plus1day'
    fallback_notice?: string
  }
  origin_conditions: {
    description: string; sun_score: number; sunshine_min: number
  }
  origin_timeline: SunTimeline // Basel's own sun bar
  sun_window: { today: DaylightWindow; tomorrow: DaylightWindow }
  max_sun_hours_today: number
  sunset: { time: string; minutes_until: number; is_past: boolean }
  tomorrow_sun_hours: number
  optimal_travel_h: number // best net-sun travel radius
  fastest_escape?: EscapeResult
  escapes: EscapeResult[]
}

export interface UserPreferences {
  default_origin?: { name: string; lat: number; lon: number }
  max_travel_h: number; travel_mode: TravelMode; has_ga: boolean
  preferred_types: DestinationType[]
}

export interface SunnyEscapesQuery {
  lat: number; lon: number; max_travel_h: number; mode: TravelMode
  ga?: boolean; types?: DestinationType[]; limit?: number
}
