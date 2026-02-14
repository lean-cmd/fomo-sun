import { Destination } from '@/lib/types'

/**
 * FOMO Sun - Curated Destination List (v0)
 * 
 * ~50 destinations for MVP, covering:
 * - Swiss mountains/viewpoints above typical fog ceiling (>600m)
 * - Swiss towns known for sun during inversions
 * - German Black Forest / Bodensee border destinations
 * - French Alsace / Jura destinations
 * 
 * Criteria for inclusion:
 * - Reachable from Basel/Zurich/Bern within 1-4 hours
 * - Known to be above typical fog ceiling OR in a different weather zone
 * - Has something to do (viewpoint, walk, food, town)
 * 
 * Sources: MeteoSwiss local-forecast point list, personal knowledge, tourism sites
 */
export const destinations: Destination[] = [
  // ===== SWISS JURA =====
  {
    id: 'chasseral',
    name: 'Chasseral',
    region: 'Jura, BE',
    country: 'CH',
    lat: 47.132,
    lon: 7.054,
    altitude_m: 1607,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Summit panoramic viewpoint over the sea of fog | Ridge walk (30-60 min) | Lunch at Hotel Chasseral restaurant',
    webcam_url: 'https://www.chasseral.ch/webcam',
    maps_url: 'https://maps.google.com/?q=47.132,7.054',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Highest peak in the Bernese Jura with spectacular views over the Swiss Plateau fog sea. Restaurant at summit.'
  },
  {
    id: 'weissenstein',
    name: 'Weissenstein',
    region: 'Jura, SO',
    country: 'CH',
    lat: 47.252,
    lon: 7.512,
    altitude_m: 1395,
    types: ['nature', 'viewpoint', 'mountain', 'family'],
    plan_template: 'Gondola ride up from Oberdorf | Panorama trail along the ridge | Restaurant Sennhaus or Kurhaus Weissenstein',
    maps_url: 'https://maps.google.com/?q=47.252,7.512',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Classic Solothurn sun escape with gondola access. Panoramic ridge trail and multiple restaurants.'
  },
  {
    id: 'grenchenberg',
    name: 'Grenchenberg',
    region: 'Jura, SO',
    country: 'CH',
    lat: 47.221,
    lon: 7.378,
    altitude_m: 1348,
    types: ['nature', 'viewpoint'],
    plan_template: 'Drive up or hike from Grenchen | Panoramic views of Alps and fog sea | Berghaus Grenchenberg for lunch',
    maps_url: 'https://maps.google.com/?q=47.221,7.378',
    description: 'Quieter alternative to Weissenstein with equally stunning fog sea views.'
  },
  {
    id: 'vue-des-alpes',
    name: 'Vue des Alpes',
    region: 'Jura, NE',
    country: 'CH',
    lat: 47.060,
    lon: 6.878,
    altitude_m: 1283,
    types: ['nature', 'viewpoint'],
    plan_template: 'Pass road viewpoint | Short walks in both directions | Restaurant at the pass',
    maps_url: 'https://maps.google.com/?q=47.060,6.878',
    description: 'Mountain pass between La Chaux-de-Fonds and Neuchatel. Often above the fog with Alpine panorama.'
  },

  // ===== SWISS PRE-ALPS (BERN/CENTRAL) =====
  {
    id: 'rigi',
    name: 'Rigi Kulm',
    region: 'Central Switzerland, SZ',
    country: 'CH',
    lat: 47.057,
    lon: 8.485,
    altitude_m: 1798,
    types: ['nature', 'viewpoint', 'mountain', 'family'],
    plan_template: 'Rack railway from Vitznau or Arth-Goldau | Summit panorama (360 degree view) | Multiple restaurants | Descent via different route',
    maps_url: 'https://maps.google.com/?q=47.057,8.485',
    sbb_url: 'https://www.sbb.ch/en',
    webcam_url: 'https://www.rigi.ch/en/Discover/Webcams',
    description: 'The "Queen of Mountains" - iconic fog sea viewpoint. Rack railway from two sides. GA valid on trains.'
  },
  {
    id: 'pilatus',
    name: 'Pilatus',
    region: 'Central Switzerland, NW/OW',
    country: 'CH',
    lat: 46.979,
    lon: 8.255,
    altitude_m: 2128,
    types: ['nature', 'viewpoint', 'mountain', 'family'],
    plan_template: 'Gondola from Kriens or rack railway from Alpnachstad | Summit terrace and restaurant | Golden roundtrip option (boat + rail + gondola)',
    maps_url: 'https://maps.google.com/?q=46.979,8.255',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Dramatic peak above Lucerne. Multiple access routes. Always above the fog.'
  },
  {
    id: 'bantiger',
    name: 'Bantiger',
    region: 'Bern, BE',
    country: 'CH',
    lat: 46.977,
    lon: 7.528,
    altitude_m: 947,
    types: ['nature', 'viewpoint'],
    plan_template: 'Short hike from Ferenberg (30 min) | Transmission tower viewpoint | Gasthof Bantiger for lunch',
    maps_url: 'https://maps.google.com/?q=46.977,7.528',
    description: 'Easy escape from Bern. Often just above the fog ceiling. Quick hike to the top.'
  },
  {
    id: 'gurten',
    name: 'Gurten',
    region: 'Bern, BE',
    country: 'CH',
    lat: 46.921,
    lon: 7.435,
    altitude_m: 858,
    types: ['nature', 'viewpoint', 'family', 'food'],
    plan_template: 'Funicular from Wabern | Panoramic view over Bern and Alps | Restaurant Gurten with terrace | Playground for kids',
    maps_url: 'https://maps.google.com/?q=46.921,7.435',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Bern\'s local mountain. Funicular access. Sometimes just at the fog boundary - check altitude.'
  },
  {
    id: 'niederhorn',
    name: 'Niederhorn',
    region: 'Berner Oberland, BE',
    country: 'CH',
    lat: 46.710,
    lon: 7.778,
    altitude_m: 1963,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Funicular + gondola from Beatenbucht | Summit panorama over Thunersee | Ibex viewing in winter | Mountain restaurant',
    maps_url: 'https://maps.google.com/?q=46.710,7.778',
    description: 'Above Lake Thun with views deep into the Bernese Alps. Reliable sun above inversions.'
  },

  // ===== ZURICH OBERLAND / EASTERN =====
  {
    id: 'bachtel',
    name: 'Bachtel',
    region: 'Zurich Oberland, ZH',
    country: 'CH',
    lat: 47.270,
    lon: 8.870,
    altitude_m: 1115,
    types: ['nature', 'viewpoint'],
    plan_template: 'Hike from Wald (45 min) | Observation tower at summit | Bachtel-Kulm restaurant with panoramic terrace',
    maps_url: 'https://maps.google.com/?q=47.270,8.870',
    description: 'Zurich Oberland\'s fog escape. Tower gives views over the fog sea to the Alps.'
  },
  {
    id: 'pfannenstiel',
    name: 'Pfannenstiel',
    region: 'Zurich, ZH',
    country: 'CH',
    lat: 47.304,
    lon: 8.653,
    altitude_m: 853,
    types: ['nature', 'viewpoint', 'family'],
    plan_template: 'Walk from Meilen or Egg (30 min) | Viewpoint over Lake Zurich and fog | Restaurant Pfannenstiel',
    maps_url: 'https://maps.google.com/?q=47.304,8.653',
    description: 'Zurich\'s east-shore hill. Often right at the fog boundary. Quick escape from the city.'
  },
  {
    id: 'uetliberg',
    name: 'Uetliberg',
    region: 'Zurich, ZH',
    country: 'CH',
    lat: 47.350,
    lon: 8.492,
    altitude_m: 871,
    types: ['nature', 'viewpoint', 'family'],
    plan_template: 'S10 train from Zurich HB (20 min) | Summit tower | Planetenweg trail to Felsenegg | Gondola down to Adliswil',
    maps_url: 'https://maps.google.com/?q=47.350,8.492',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Zurich\'s house mountain. Direct S-Bahn access. Classic fog escape but sometimes still in the fog at 870m.'
  },
  {
    id: 'fronalpstock',
    name: 'Fronalpstock',
    region: 'Schwyz, SZ',
    country: 'CH',
    lat: 46.977,
    lon: 8.627,
    altitude_m: 1922,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Cable car from Stoos | Panoramic ridge walk | View of 10 lakes | Restaurant Fronalpstock',
    maps_url: 'https://maps.google.com/?q=46.977,8.627',
    description: 'Famous for its 10-lake panorama above the fog. Access via the world\'s steepest funicular to Stoos.'
  },

  // ===== SWISS ROMANDE =====
  {
    id: 'rochers-de-naye',
    name: 'Rochers de Naye',
    region: 'Vaud, VD',
    country: 'CH',
    lat: 46.432,
    lon: 6.976,
    altitude_m: 2042,
    types: ['nature', 'viewpoint', 'mountain', 'family'],
    plan_template: 'Rack railway from Montreux (55 min) | Summit panorama | Marmot park (summer) | Restaurant at summit',
    maps_url: 'https://maps.google.com/?q=46.432,6.976',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Above Montreux with views over Lake Geneva. Rack railway from Montreux station. Always above the fog.'
  },
  {
    id: 'la-dole',
    name: 'La Dole',
    region: 'Jura, VD',
    country: 'CH',
    lat: 46.425,
    lon: 6.100,
    altitude_m: 1677,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Hike from St-Cergue (1.5h) | Summit with radar dome and panorama | Views to Mont Blanc and Lake Geneva',
    maps_url: 'https://maps.google.com/?q=46.425,6.100',
    description: 'Highest point of the Swiss Jura above Lake Geneva. Spectacular panorama including Mont Blanc.'
  },

  // ===== SWISS TOWNS ABOVE FOG =====
  {
    id: 'adelboden',
    name: 'Adelboden',
    region: 'Berner Oberland, BE',
    country: 'CH',
    lat: 46.493,
    lon: 7.557,
    altitude_m: 1353,
    types: ['town', 'mountain', 'food', 'family'],
    plan_template: 'Stroll through the village | Panoramic winter walk | Lunch at a traditional restaurant | Optional: Tschentenalp gondola',
    maps_url: 'https://maps.google.com/?q=46.493,7.557',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Charming Bernese Oberland village reliably above the fog. Good restaurants and easy winter walks.'
  },
  {
    id: 'grindelwald',
    name: 'Grindelwald',
    region: 'Berner Oberland, BE',
    country: 'CH',
    lat: 46.624,
    lon: 8.041,
    altitude_m: 1034,
    types: ['town', 'mountain', 'viewpoint', 'family'],
    plan_template: 'Village walk with Eiger views | First gondola for panorama | Lunch at a mountain restaurant | Optional: Jungfraujoch excursion',
    maps_url: 'https://maps.google.com/?q=46.624,8.041',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Famous Eiger village. Reliably above fog with dramatic mountain backdrop.'
  },
  {
    id: 'leysin',
    name: 'Leysin',
    region: 'Vaud, VD',
    country: 'CH',
    lat: 46.343,
    lon: 7.013,
    altitude_m: 1263,
    types: ['town', 'mountain', 'family'],
    plan_template: 'Village walk with panoramic views | Berneuse revolving restaurant | Easy winter walks | Views over Rhone valley fog',
    maps_url: 'https://maps.google.com/?q=46.343,7.013',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Sun terrace above the Rhone valley. Known for its microclimate and sunny days above the fog.'
  },

  // ===== LAKE DESTINATIONS =====
  {
    id: 'brienz',
    name: 'Brienz',
    region: 'Berner Oberland, BE',
    country: 'CH',
    lat: 46.754,
    lon: 8.041,
    altitude_m: 566,
    types: ['town', 'lake', 'family', 'food'],
    plan_template: 'Lakeside promenade walk | Ballenberg open-air museum (optional) | Brienz Rothorn steam railway | Lunch by the lake',
    maps_url: 'https://maps.google.com/?q=46.754,8.041',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'On turquoise Lake Brienz. Lower altitude but often in a different weather zone than the Plateau.'
  },
  {
    id: 'thun',
    name: 'Thun',
    region: 'Berner Oberland, BE',
    country: 'CH',
    lat: 46.759,
    lon: 7.629,
    altitude_m: 558,
    types: ['town', 'lake', 'food', 'family'],
    plan_template: 'Old town walk + castle visit | Lakeside promenade | Lunch in Obere Hauptgasse | Optional: boat on Thunersee',
    maps_url: 'https://maps.google.com/?q=46.759,7.629',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Gateway to the Bernese Oberland. Castle, old town, lake. Sometimes above fog, sometimes not - check score.'
  },

  // ===== GERMAN BLACK FOREST (BORDER) =====
  {
    id: 'feldberg-schwarzwald',
    name: 'Feldberg',
    region: 'Black Forest, Baden-Wurttemberg',
    country: 'DE',
    lat: 47.874,
    lon: 8.004,
    altitude_m: 1493,
    types: ['nature', 'viewpoint', 'mountain', 'family'],
    plan_template: 'Drive or bus to summit area | Feldberg tower panoramic views | Ridge walks | Naturfreundehaus or Baldenweger Hutte for food',
    maps_url: 'https://maps.google.com/?q=47.874,8.004',
    description: 'Highest point of the Black Forest. Well above any fog. About 1h from Basel by car.'
  },
  {
    id: 'belchen-schwarzwald',
    name: 'Belchen',
    region: 'Black Forest, Baden-Wurttemberg',
    country: 'DE',
    lat: 47.822,
    lon: 7.833,
    altitude_m: 1414,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Gondola from Multen | Summit panorama to Alps and Vosges | Ridge walk | Belchenhaus restaurant',
    maps_url: 'https://maps.google.com/?q=47.822,7.833',
    description: 'Some say the best panorama in the Black Forest. Gondola access. Views to the Alps on clear days.'
  },
  {
    id: 'schauinsland',
    name: 'Schauinsland',
    region: 'Black Forest, Baden-Wurttemberg',
    country: 'DE',
    lat: 47.905,
    lon: 7.898,
    altitude_m: 1284,
    types: ['nature', 'viewpoint', 'mountain', 'family'],
    plan_template: 'Gondola from Horben (near Freiburg) | Summit tower | Easy walks | Hof Schniederlihof museum | Gasthaus Schauinsland',
    maps_url: 'https://maps.google.com/?q=47.905,7.898',
    description: 'Freiburg\'s local mountain with cable car access. Easy day trip from Basel (1h).'
  },
  {
    id: 'freiburg-im-breisgau',
    name: 'Freiburg im Breisgau',
    region: 'Baden-Wurttemberg',
    country: 'DE',
    lat: 47.999,
    lon: 7.842,
    altitude_m: 278,
    types: ['town', 'food', 'family'],
    plan_template: 'Old town with Bachle streams | Munster cathedral and market | Schlossberg viewpoint | Augustiner beer hall for lunch',
    maps_url: 'https://maps.google.com/?q=47.999,7.842',
    description: 'Germany\'s sunniest city. Low altitude but in the Rhine valley, often different weather than Swiss Plateau.'
  },
  {
    id: 'todtnauer-wasserfall',
    name: 'Todtnauer Wasserfall',
    region: 'Black Forest, Baden-Wurttemberg',
    country: 'DE',
    lat: 47.837,
    lon: 7.946,
    altitude_m: 820,
    types: ['nature', 'family'],
    plan_template: 'Short hike to the waterfall (20 min) | Continue uphill for forest walks | Lunch in Todtnau village',
    maps_url: 'https://maps.google.com/?q=47.837,7.946',
    description: 'Germany\'s highest waterfall. Beautiful even in winter (frozen). Easy hike for families.'
  },
  {
    id: 'konstanz',
    name: 'Konstanz',
    region: 'Bodensee, Baden-Wurttemberg',
    country: 'DE',
    lat: 47.660,
    lon: 9.175,
    altitude_m: 405,
    types: ['town', 'lake', 'food', 'family'],
    plan_template: 'Old town walk | Lakeside promenade | Imperia statue | Shopping (Sunday shopping DE side!) | Lake fish restaurant',
    maps_url: 'https://maps.google.com/?q=47.660,9.175',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Lake Constance town on the German side. Different microclimate from the Plateau. Sunday shopping!'
  },

  // ===== FRENCH ALSACE / JURA (BORDER) =====
  {
    id: 'colmar',
    name: 'Colmar',
    region: 'Alsace, Haut-Rhin',
    country: 'FR',
    lat: 48.079,
    lon: 7.358,
    altitude_m: 194,
    types: ['town', 'food', 'family'],
    plan_template: 'Petite Venise walk | Covered market for tarte flambee | Wine bars in old town | Unterlinden museum',
    maps_url: 'https://maps.google.com/?q=48.079,7.358',
    description: 'Driest city in France. Charming Alsatian old town. Famous Christmas market. About 1h from Basel.'
  },
  {
    id: 'eguisheim',
    name: 'Eguisheim',
    region: 'Alsace, Haut-Rhin',
    country: 'FR',
    lat: 48.042,
    lon: 7.307,
    altitude_m: 210,
    types: ['town', 'food'],
    plan_template: 'Walk the circular village (30 min) | Wine tasting in local caves | Lunch at a winstub | Three Castles hike above town',
    maps_url: 'https://maps.google.com/?q=48.042,7.307',
    description: 'Voted France\'s favorite village. Circular medieval layout. Outstanding wine. 45min from Basel.'
  },
  {
    id: 'grand-ballon',
    name: 'Grand Ballon',
    region: 'Vosges, Haut-Rhin',
    country: 'FR',
    lat: 47.905,
    lon: 7.099,
    altitude_m: 1424,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Drive Route des Cretes | Summit viewpoint | Panorama from Alps to Black Forest | Ferme-auberge for Munster cheese',
    maps_url: 'https://maps.google.com/?q=47.905,7.099',
    description: 'Highest point of the Vosges. On a clear day, views all the way to the Alps. About 1h from Basel.'
  },
  {
    id: 'hohneck',
    name: 'Hohneck',
    region: 'Vosges, Haut-Rhin',
    country: 'FR',
    lat: 48.043,
    lon: 7.010,
    altitude_m: 1363,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Drive to col | Summit hike (30 min) | Panoramic views | Ferme-auberge du Gaschney for marcaire meal',
    maps_url: 'https://maps.google.com/?q=48.043,7.010',
    description: 'Third highest peak in Vosges. Often above the Alsatian plain fog. Traditional farm-restaurants nearby.'
  },
  {
    id: 'mulhouse',
    name: 'Mulhouse',
    region: 'Alsace, Haut-Rhin',
    country: 'FR',
    lat: 47.750,
    lon: 7.335,
    altitude_m: 240,
    types: ['town', 'family', 'food'],
    plan_template: 'Cite de l\'Automobile (Bugatti museum) | Old town walk | Tarte flambee lunch | Zoo (family)',
    maps_url: 'https://maps.google.com/?q=47.750,7.335',
    description: 'Industrial city with world-class car museum. 30min from Basel. Good rainy day backup too.'
  },

  // ===== MORE SWISS FAVORITES =====
  {
    id: 'stoos',
    name: 'Stoos',
    region: 'Schwyz, SZ',
    country: 'CH',
    lat: 46.977,
    lon: 8.654,
    altitude_m: 1305,
    types: ['town', 'mountain', 'family', 'viewpoint'],
    plan_template: 'World\'s steepest funicular (110%) | Car-free village stroll | Fronalpstock cable car for panorama | Restaurant Stoos Lodge',
    maps_url: 'https://maps.google.com/?q=46.977,8.654',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Car-free village accessed by the world\'s steepest funicular. Great family destination above the fog.'
  },
  {
    id: 'hasliberg',
    name: 'Hasliberg',
    region: 'Berner Oberland, BE',
    country: 'CH',
    lat: 46.747,
    lon: 8.169,
    altitude_m: 1082,
    types: ['town', 'mountain', 'family'],
    plan_template: 'Gondola from Meiringen | Muggestutz dwarf trail (family) | Panoramic walks | Mountain restaurants',
    maps_url: 'https://maps.google.com/?q=46.747,8.169',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Family-friendly mountain village above the Aare valley. Famous dwarf trail. Reliably above fog.'
  },
  {
    id: 'braunwald',
    name: 'Braunwald',
    region: 'Glarus, GL',
    country: 'CH',
    lat: 46.944,
    lon: 8.999,
    altitude_m: 1256,
    types: ['town', 'mountain', 'family', 'viewpoint'],
    plan_template: 'Funicular from Linthal | Car-free village walk | Panoramic views to Todi | Lunch at Cristal restaurant',
    maps_url: 'https://maps.google.com/?q=46.944,8.999',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Car-free mountain village above the Linth valley. Funicular access. Always above the fog.'
  },
  {
    id: 'muottas-muragl',
    name: 'Muottas Muragl',
    region: 'Engadin, GR',
    country: 'CH',
    lat: 46.499,
    lon: 9.949,
    altitude_m: 2456,
    types: ['nature', 'viewpoint', 'mountain', 'food'],
    plan_template: 'Funicular from Punt Muragl | Panoramic terrace with Engadin lakes view | Height trail to Alp Languard | Romantik Hotel dinner',
    maps_url: 'https://maps.google.com/?q=46.499,9.949',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Famous Engadin viewpoint. Incredible panorama over the Upper Engadin lakes. Romantic hotel at top. About 3.5h from Basel.'
  },
  {
    id: 'napf',
    name: 'Napf',
    region: 'Emmental, BE/LU',
    country: 'CH',
    lat: 47.003,
    lon: 7.944,
    altitude_m: 1408,
    types: ['nature', 'viewpoint', 'mountain'],
    plan_template: 'Hike from Mettlenalp (1h) or Luthern (2h) | 360-degree summit panorama | Berggasthaus Napf for Rosti',
    maps_url: 'https://maps.google.com/?q=47.003,7.944',
    description: 'The highest point in the Emmental. Famous 360-degree panorama. Classic fog-sea viewpoint.'
  },
  {
    id: 'moléson',
    name: 'Moleson',
    region: 'Gruyere, FR',
    country: 'CH',
    lat: 46.549,
    lon: 7.018,
    altitude_m: 2002,
    types: ['nature', 'viewpoint', 'mountain', 'food'],
    plan_template: 'Cable car from Moleson-sur-Gruyeres | Summit 360 panorama | Cheese fondue in Gruyeres village | Gruyeres castle visit',
    maps_url: 'https://maps.google.com/?q=46.549,7.018',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Above the Gruyere region. Combine summit views with cheese fondue in one of Switzerland\'s prettiest villages.'
  },
  {
    id: 'gruyeres',
    name: 'Gruyeres',
    region: 'Fribourg, FR',
    country: 'CH',
    lat: 46.584,
    lon: 7.081,
    altitude_m: 810,
    types: ['town', 'food', 'family'],
    plan_template: 'Medieval village walk | Castle visit | HR Giger Museum | Fondue at Chalet de Gruyeres | Cheese factory tour',
    maps_url: 'https://maps.google.com/?q=46.584,7.081',
    sbb_url: 'https://www.sbb.ch/en',
    description: 'Medieval hilltop village. Cheese, castle, and surprisingly: the HR Giger museum. Often above the fog.'
  },

  // ===== ADDITIONAL BORDER DESTINATIONS =====
  {
    id: 'badenweiler',
    name: 'Badenweiler',
    region: 'Black Forest, Baden-Wurttemberg',
    country: 'DE',
    lat: 47.803,
    lon: 7.672,
    altitude_m: 425,
    types: ['town', 'thermal', 'food'],
    plan_template: 'Cassiopeia thermal baths | Park walk with Black Forest views | Lunch at a local Gasthaus | Roman bath ruins',
    maps_url: 'https://maps.google.com/?q=47.803,7.672',
    description: 'Elegant thermal spa town. Only 40min from Basel. Thermal baths with outdoor pool overlooking the Rhine valley.'
  },
  {
    id: 'kaysersberg',
    name: 'Kaysersberg',
    region: 'Alsace, Haut-Rhin',
    country: 'FR',
    lat: 48.139,
    lon: 7.264,
    altitude_m: 242,
    types: ['town', 'food'],
    plan_template: 'Fortified bridge and old town walk | Wine tasting | Castle ruins viewpoint | Winstub lunch',
    maps_url: 'https://maps.google.com/?q=48.139,7.264',
    description: 'Albert Schweitzer\'s birthplace. One of the prettiest Alsatian wine villages. About 1h from Basel.'
  },
  {
    id: 'riquewihr',
    name: 'Riquewihr',
    region: 'Alsace, Haut-Rhin',
    country: 'FR',
    lat: 48.167,
    lon: 7.298,
    altitude_m: 300,
    types: ['town', 'food'],
    plan_template: 'Walk through the medieval main street | Wine tasting (Riesling and Gewurztraminer) | Dolder tower | Tarte flambee for lunch',
    maps_url: 'https://maps.google.com/?q=48.167,7.298',
    description: 'Incredibly preserved medieval wine village. Often cited as the most beautiful village on the Alsace wine route.'
  },
  {
    id: 'titisee',
    name: 'Titisee',
    region: 'Black Forest, Baden-Wurttemberg',
    country: 'DE',
    lat: 47.890,
    lon: 8.150,
    altitude_m: 845,
    types: ['lake', 'nature', 'family', 'food'],
    plan_template: 'Lake walk around Titisee (1.5h) | Boat ride | Black Forest cake at a lakeside cafe | Optional: Badeparadies waterpark',
    maps_url: 'https://maps.google.com/?q=47.890,8.150',
    description: 'Scenic Black Forest lake at 845m. Good altitude to be above most fog. Black Forest cake capital.'
  },

  // ===== POPULAR TOURIST DESTINATIONS FROM BASEL =====
  {
    id: 'strasbourg',
    name: 'Strasbourg',
    region: 'Alsace, Bas-Rhin',
    country: 'FR',
    lat: 48.5734,
    lon: 7.7521,
    altitude_m: 142,
    types: ['town', 'food', 'family'],
    plan_template: 'Petite France quarter & half-timbered houses | Strasbourg Cathedral (climb the tower) | Tarte flambée lunch at a winstub | Boat tour on the Ill river',
    webcam_url: 'https://www.strasbourg.eu/webcams',
    maps_url: 'https://maps.google.com/?q=48.5734,7.7521',
    sbb_url: 'https://www.sbb.ch/en/buying/pages/fahrplan/fahrplan.xhtml?nach=Strasbourg',
    description: 'UNESCO old town, cathedral, Petite France. 1.5h from Basel by train. Often in a different weather zone than Basel.'
  },
  {
    id: 'lucerne',
    name: 'Lucerne',
    region: 'Central Switzerland',
    country: 'CH',
    lat: 47.0502,
    lon: 8.3093,
    altitude_m: 436,
    types: ['town', 'lake', 'food', 'family'],
    plan_template: 'Chapel Bridge & Water Tower photo stop | Old town walk & lion monument | Lake cruise (1h) or Rigi/Pilatus day trip | Dinner at a lakeside restaurant',
    webcam_url: 'https://www.luzern.com/en/webcams/',
    maps_url: 'https://maps.google.com/?q=47.0502,8.3093',
    sbb_url: 'https://www.sbb.ch/en/buying/pages/fahrplan/fahrplan.xhtml?nach=Luzern',
    description: 'Classic Swiss lake town. Gateway to Rigi and Pilatus. Can be foggy itself but often clears by midday.'
  },
  {
    id: 'st-moritz',
    name: 'St. Moritz',
    region: 'Engadin, GR',
    country: 'CH',
    lat: 46.4908,
    lon: 9.8355,
    altitude_m: 1822,
    types: ['town', 'viewpoint', 'nature', 'food'],
    plan_template: 'Arrive via scenic train (Glacier Express route) | Lake St. Moritz walk | Muottas Muragl panorama viewpoint | Engadin café culture & Bündner Nusstorte',
    webcam_url: 'https://www.stmoritz.ch/en/live/webcams/',
    maps_url: 'https://maps.google.com/?q=46.4908,9.8355',
    sbb_url: 'https://www.sbb.ch/en/buying/pages/fahrplan/fahrplan.xhtml?nach=St.+Moritz',
    description: 'Famous Engadin resort at 1822m. One of the sunniest places in Switzerland (322 sunny days/year). Well above any fog.'
  },
  {
    id: 'interlaken',
    name: 'Interlaken',
    region: 'Bernese Oberland',
    country: 'CH',
    lat: 46.6863,
    lon: 7.8632,
    altitude_m: 568,
    types: ['town', 'nature', 'lake', 'family'],
    plan_template: 'Höhematte promenade with Jungfrau views | Lake Thun or Lake Brienz cruise | Harder Kulm funicular for panorama | Fondue dinner',
    maps_url: 'https://maps.google.com/?q=46.6863,7.8632',
    sbb_url: 'https://www.sbb.ch/en/buying/pages/fahrplan/fahrplan.xhtml?nach=Interlaken+Ost',
    description: 'Between two lakes, gateway to Jungfrau. Can be foggy but often breaks through. Classic tourist base.'
  },
  {
    id: 'bern',
    name: 'Bern',
    region: 'Canton Bern',
    country: 'CH',
    lat: 46.9480,
    lon: 7.4474,
    altitude_m: 540,
    types: ['town', 'food', 'family'],
    plan_template: 'UNESCO old town arcade walk | Bear Park & Rosengarten viewpoint | Zytglogge clock tower | Lunch at Kornhauskeller or Altes Tramdepot',
    maps_url: 'https://maps.google.com/?q=46.9480,7.4474',
    sbb_url: 'https://www.sbb.ch/en/buying/pages/fahrplan/fahrplan.xhtml?nach=Bern',
    description: 'Swiss capital with UNESCO old town. 55 min from Basel. Often similar weather but Rosengarten offers views above the Aare.'
  },
  {
    id: 'zurich',
    name: 'Zürich',
    region: 'Canton Zürich',
    country: 'CH',
    lat: 47.3769,
    lon: 8.5417,
    altitude_m: 408,
    types: ['town', 'food', 'lake', 'family'],
    plan_template: 'Bahnhofstrasse & Lindenhof viewpoint | Old town (Niederdorf) wander | Lake Zürich promenade | Uetliberg for sunset above the fog',
    maps_url: 'https://maps.google.com/?q=47.3769,8.5417',
    sbb_url: 'https://www.sbb.ch/en/buying/pages/fahrplan/fahrplan.xhtml?nach=Zürich+HB',
    description: 'Largest Swiss city. Often foggy itself but combine with Uetliberg (already in list) for guaranteed sun above.'
  },
]

/** Default fallback origin: Basel */
export const DEFAULT_ORIGIN = {
  name: 'Basel',
  lat: 47.5596,
  lon: 7.5886,
}

/** Get destinations filtered by type */
export function filterByType(types: string[]): Destination[] {
  if (types.length === 0) return destinations
  return destinations.filter(d => d.types.some(t => types.includes(t)))
}

/** Get destinations by country */
export function filterByCountry(country: 'CH' | 'DE' | 'FR'): Destination[] {
  return destinations.filter(d => d.country === country)
}
