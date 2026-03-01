import { NextResponse } from 'next/server'
import { destinations } from '@/data/destinations'

export async function GET() {
  return NextResponse.json(
    {
      service: 'FOMO Sun',
      description: 'Find sunny destinations when your location has fog or rain',
      version: '0.8.0',
      api_base: '/api/v1',
      endpoints: {
        'sunny-escapes': {
          method: 'GET',
          description: 'Get ranked sunny escape destinations',
          params: ['lat', 'lon', 'origin', 'max_travel_h', 'travel_min_h', 'travel_max_h', 'trip_span', 'types', 'limit'],
          supports_agent_preferences: true,
        },
        'sbb-connections': {
          method: 'GET',
          description: 'Get SBB train connections to a destination',
        },
        capabilities: {
          method: 'GET',
          description: 'Service discovery endpoint',
        },
      },
      coverage: {
        countries: ['CH', 'DE', 'FR', 'IT', 'LI'],
        destinations: destinations.length,
        forecast_models: ['meteoswiss-icon-ch1', 'meteoswiss-icon-ch2', 'open-meteo-best-match'],
        forecast_horizon_hours: 120,
      },
      agent_preferences: {
        header: 'X-FOMO-Agent-Preferences',
        supported_fields: ['travel_mode', 'max_travel_h', 'destination_types', 'avoid_types', 'temperature_preference'],
        note: 'Preferences are ephemeral and never stored. No PII required.',
      },
      privacy: {
        pii_required: false,
        location_granularity: 'city',
        preferences_stored: false,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
