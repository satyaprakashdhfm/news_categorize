import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COUNTRIES } from '@/utils/helpers';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

const COUNTRY_COORDS = {
  USA: [38.2, -97.0],
  CHINA: [35.9, 104.2],
  GERMANY: [51.1, 10.4],
  INDIA: [20.6, 78.9],
  JAPAN: [36.2, 138.2],
  UK: [55.3, -3.4],
  FRANCE: [46.2, 2.2],
  ITALY: [41.9, 12.6],
};

const markerIcon = new L.DivIcon({
  className: 'country-pin',
  html: '<span class="country-pin-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FlyToCountry({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.setView(center, 4, { animate: false });
    }
  }, [center, map]);
  return null;
}

export default function GlobalMap({ stats, selectedCountry, onSelectCountry }) {
  const navigate = useNavigate();

  const countryStats = stats?.country_counts || [];
  
  const getCountryArticleCount = (code) => {
    const countryStat = countryStats.find(c => c.country === code);
    return countryStat?.count || 0;
  };

  const getCountryColor = (code) => {
    const count = getCountryArticleCount(code);
    if (count === 0) return 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300';
    if (count < 10) return 'bg-blue-200 dark:bg-blue-900/50 hover:bg-blue-300 dark:hover:bg-blue-800 text-blue-900 dark:text-blue-200';
    if (count < 50) return 'bg-blue-400 dark:bg-blue-700 hover:bg-blue-500 dark:hover:bg-blue-600 text-white';
    return 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white';
  };

  const selectedCenter = COUNTRY_COORDS[selectedCountry] || [20, 0];
  const totalArticles = countryStats.reduce((acc, item) => acc + Number(item?.count || 0), 0);
  const selectedArticles = getCountryArticleCount(selectedCountry);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-transparent dark:border-gray-700">
      <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2 flex items-center gap-2">
        Global News Coverage
      </h2>
      <p className="text-sm text-secondary-600 dark:text-gray-300 mb-4">
        Click a country pin to select it. Use Open Country Page to go deeper.
      </p>

      <div className="rounded-xl overflow-hidden border border-secondary-200 dark:border-gray-700">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={5}
          scrollWheelZoom={true}
          preferCanvas={true}
          zoomAnimation={false}
          fadeAnimation={false}
          markerZoomAnimation={false}
          className="h-[260px] sm:h-[360px] md:h-[460px] w-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />
          <FlyToCountry center={selectedCenter} />

          {COUNTRIES.map((country) => {
            const coords = COUNTRY_COORDS[country.code];
            if (!coords) {
              return null;
            }
            const articleCount = getCountryArticleCount(country.code);
            const isActive = selectedCountry === country.code;
            return (
              <Marker key={country.code} position={coords} icon={markerIcon} eventHandlers={{
                click: () => onSelectCountry?.(country.code),
              }}>
                <Popup>
                  <div className="space-y-1 min-w-[170px]">
                    <p className="font-semibold">{country.flag} {country.name}</p>
                    <p className="text-xs">Code: {country.code}</p>
                    <p className="text-xs">GDP: {country.gdp}</p>
                    <p className="text-xs">Articles: {articleCount}</p>
                    <button
                      onClick={() => navigate(`/country/${country.code}`)}
                      className="mt-1 w-full rounded-md px-2 py-1 text-xs font-semibold bg-blue-600 text-white"
                    >
                      Open Country Page
                    </button>
                    {isActive ? <p className="text-[11px] text-emerald-700">Selected on home</p> : null}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-secondary-100 dark:bg-gray-900 p-3 text-secondary-800 dark:text-gray-200">
          <p className="text-xs text-secondary-500 dark:text-gray-400">Total Articles On Map</p>
          <p className="font-semibold text-lg">{totalArticles.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-secondary-100 dark:bg-gray-900 p-3 text-secondary-800 dark:text-gray-200">
          <p className="text-xs text-secondary-500 dark:text-gray-400">Selected Country ({selectedCountry})</p>
          <p className="font-semibold text-lg">{selectedArticles.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {COUNTRIES.map((country) => {
          const articleCount = getCountryArticleCount(country.code);
          const colorClass = getCountryColor(country.code);
          return (
            <button
              key={country.code}
              onClick={() => onSelectCountry?.(country.code)}
              className={`${colorClass} rounded-lg px-3 py-2 text-xs font-semibold transition-all`}
            >
              {country.flag} {country.code} • {articleCount}
            </button>
          );
        })}
      </div>
    </div>
  );
}
