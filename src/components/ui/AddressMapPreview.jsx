import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet default marker icon issue with bundlers using local assets
const defaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/**
 * Componente hijo que permite arrastrar el marcador y actualizar la posición.
 */
const DraggableMarker = ({ position, onPositionChange }) => {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (!marker) return;
      const { lat, lng } = marker.getLatLng();
      onPositionChange(lat, lng);
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={defaultIcon}
    />
  );
};

/**
 * Componente hijo para re-centrar el mapa cuando cambia la posición.
 */
const RecenterMap = ({ position }) => {
  const map = useMapEvents({});

  useEffect(() => {
    if (position) {
      map.flyTo(position, 16, { duration: 1.2 });
    }
  }, [position, map]);

  return null;
};

/**
 * AddressMapPreview — Mini-mapa para confirmar la dirección del restaurante.
 * 
 * @param {number} latitude - Latitud actual
 * @param {number} longitude - Longitud actual
 * @param {function} onPositionChange - Callback(lat, lng) cuando el usuario mueve el marcador
 */
const AddressMapPreview = ({ latitude, longitude, onPositionChange }) => {
  const hasPosition = latitude && longitude;
  const position = hasPosition ? [latitude, longitude] : [19.4326, -99.1332]; // Default: CDMX

  return (
    <div className="mini-map-container mt-3" style={{ height: '200px' }}>
      <MapContainer
        center={position}
        zoom={hasPosition ? 16 : 4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
        className="dark-tiles"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {hasPosition && (
          <>
            <DraggableMarker
              position={position}
              onPositionChange={onPositionChange}
            />
            <RecenterMap position={position} />
          </>
        )}
      </MapContainer>
      {hasPosition && (
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          Arrastra el marcador si la ubicación no es exacta.
        </p>
      )}
      {!hasPosition && (
        <p className="text-xs text-slate-500 mt-2">
          Escribe una dirección arriba para ver la ubicación en el mapa.
        </p>
      )}
    </div>
  );
};

export default AddressMapPreview;
