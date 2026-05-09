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

  const getCountryStyle = (code) => {
    const count = getCountryArticleCount(code);
    if (count === 0) return { background: 'var(--bg-3)', color: 'var(--fg-3)' };
    if (count < 10) return { background: 'var(--accent-soft)', color: 'var(--accent)' };
    if (count < 50) return { background: 'rgba(127,212,209,0.25)', color: 'var(--accent)' };
    return { background: 'var(--accent)', color: 'var(--fg-on-accent)' };
  };

  const selectedCenter = COUNTRY_COORDS[selectedCountry] || [20, 0];
  const totalArticles = countryStats.reduce((acc, item) => acc + Number(item?.count || 0), 0);
  const selectedArticles = getCountryArticleCount(selectedCountry);

  return (
    <div className="panel">
      <h2 style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        Global News Coverage
      </h2>
      <p style={{ fontSize: 'var(--t-meta)', color: 'var(--fg-2)', marginBottom: 16 }}>
        Click a country pin to select it. Use Open Country Page to go deeper.
      </p>

      <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line-1)' }}>
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
                      className="btn btn--primary"
                      style={{ marginTop: 4, width: '100%', justifyContent: 'center', fontSize: 'var(--t-meta)' }}
                    >
                      Open Country Page
                    </button>
                    {isActive ? <p style={{ fontSize: 'var(--t-micro)', color: 'var(--signal-positive)' }}>Selected on home</p> : null}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ fontSize: 'var(--t-meta)' }}>
        <div style={{ borderRadius: 'var(--r-md)', background: 'var(--bg-2)', padding: 12, color: 'var(--fg-1)' }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Total Articles On Map</p>
          <p style={{ fontWeight: 600, fontSize: 'var(--t-h3)', margin: 0 }}>{totalArticles.toLocaleString()}</p>
        </div>
        <div style={{ borderRadius: 'var(--r-md)', background: 'var(--bg-2)', padding: 12, color: 'var(--fg-1)' }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Selected Country ({selectedCountry})</p>
          <p style={{ fontWeight: 600, fontSize: 'var(--t-h3)', margin: 0 }}>{selectedArticles.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {COUNTRIES.map((country) => {
          const articleCount = getCountryArticleCount(country.code);
          const cStyle = getCountryStyle(country.code);
          return (
            <button
              key={country.code}
              onClick={() => onSelectCountry?.(country.code)}
              style={{
                ...cStyle,
                borderRadius: 'var(--r-md)',
                padding: '6px 12px',
                fontSize: 'var(--t-meta)',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {country.flag} {country.code} &bull; {articleCount}
            </button>
          );
        })}
      </div>
    </div>
  );
}
