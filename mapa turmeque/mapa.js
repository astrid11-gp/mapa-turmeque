// ====== LUGARES TURÍSTICOS Y DE SERVICIO ======
// "buscar" = lo que el mapa busca para ubicar el punto automáticamente.
// lat/lng = posición de respaldo si la búsqueda no encuentra nada.
const lugares = [
  { nombre: "Iglesia Nuestra Señora del Rosario",
    buscar: "Iglesia Nuestra Señora del Rosario Turmequé",
    lat: 5.32331, lng: -73.49056,
    descripcion: "Templo parroquial en el costado de la plaza principal." },
  { nombre: "Parque Principal",
    buscar: "Parque Principal Turmequé",
    lat: 5.32318, lng: -73.49040,
    descripcion: "Plaza principal, con el monumento al cacique Turmequé." },
  { nombre: "Museo Religioso (Casa Cural)",
    buscar: "Casa Cural Turmequé",
    lat: 5.32340, lng: -73.49065,
    descripcion: "Museo ubicado en la casa cural, junto a la iglesia." },
  { nombre: "Hospital Baudilio Acero",
    buscar: "Hospital Baudilio Acero Turmequé",
    lat: 5.32300, lng: -73.49000,
    descripcion: "E.S.E. Hospital Baudilio Acero de Turmequé." },
  { nombre: "Plaza de Mercado",
    buscar: "Plaza de Mercado Turmequé",
    lat: 5.32290, lng: -73.49080,
    descripcion: "Plaza de mercado del pueblo. El día de mercado es el lunes." }
];

// ====== MAPA ======
const CENTRO = [5.32331, -73.49056];
const map = L.map("map").setView(CENTRO, 16);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

map.setMinZoom(11);

// ====== MARCADORES ======
const marcadores = lugares.map((l, i) =>
  L.marker([l.lat, l.lng]).addTo(map).bindPopup(
    `<div class="lugar-titulo">${l.nombre}</div>${l.descripcion}<br>
     <button class="btn-ir" onclick="irA(${i})">🧭 Ir aquí</button>`
  )
);

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function buscarPunto(texto) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1"
    + "&viewbox=-73.502,5.335,-73.480,5.312&q=" + encodeURIComponent(texto);
  const res = await fetch(url);
  const data = await res.json();
  if (!data.length) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

async function ubicarLugares() {
  for (let i = 0; i < lugares.length; i++) {
    try {
      const punto = await buscarPunto(lugares[i].buscar);
      if (punto) marcadores[i].setLatLng(punto);
    } catch (e) {
      console.warn("No se pudo buscar:", lugares[i].nombre, e);
    }
    await esperar(1100); // el servicio pide máximo 1 búsqueda por segundo
  }
}
ubicarLugares();

// ====== CONTORNO DEL MUNICIPIO (solo se ve Turmequé) ======
async function cargarContorno() {
  try {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&limit=1&q="
      + encodeURIComponent("Turmequé, Boyacá, Colombia");
    const res = await fetch(url);
    const data = await res.json();
    const geo = data[0].geojson;

    const polys = geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates;
    const huecos = polys.map(p => p[0].map(([lng, lat]) => [lat, lng]));

    const mundo = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
    L.polygon([mundo, ...huecos], {
      weight: 0, fillColor: "#f2f2f2", fillOpacity: 0.92, interactive: false
    }).addTo(map);

    L.geoJSON(geo, {
      style: { color: "#1b5e20", weight: 3, fillOpacity: 0, interactive: false }
    }).addTo(map);
  } catch (e) {
    console.warn("No se pudo cargar el contorno.", e);
  }
}
cargarContorno();

// ====== AYUDA: clic en el mapa para ver coordenadas ======
map.on("click", e => {
  L.popup()
    .setLatLng(e.latlng)
    .setContent(`Coordenadas:<br><b>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</b>`)
    .openOn(map);
});

// ====== UBICACIÓN DEL USUARIO ======
let marcadorYo = null;

function obtenerUbicacion() {
  return new Promise((resolver, rechazar) => {
    if (!navigator.geolocation) return rechazar(new Error("Sin geolocalización"));
    navigator.geolocation.getCurrentPosition(
      p => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      rechazar,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

function mostrarYo(p) {
  if (marcadorYo) map.removeLayer(marcadorYo);
  marcadorYo = L.circleMarker([p.lat, p.lng], {
    radius: 9, color: "#fff", weight: 3, fillColor: "#1976d2", fillOpacity: 1
  }).addTo(map).bindPopup("Estás aquí");
}

document.getElementById("btn-ubicacion").addEventListener("click", async () => {
  try {
    const p = await obtenerUbicacion();
    mostrarYo(p);
    map.setView([p.lat, p.lng], 16);
    marcadorYo.openPopup();
  } catch (e) {
    alert("No se pudo obtener tu ubicación. Revisa que el navegador tenga permiso.");
  }
});

// ====== RUTAS ======
const selOrigen = document.getElementById("sel-origen");
const selDestino = document.getElementById("sel-destino");
const info = document.getElementById("info-ruta");
let capaRuta = null;

// Llenar las listas
selOrigen.innerHTML = `<option value="gps">📍 Mi ubicación</option>`
  + lugares.map((l, i) => `<option value="${i}">${l.nombre}</option>`).join("");
selDestino.innerHTML = `<option value="">Elige un destino…</option>`
  + lugares.map((l, i) => `<option value="${i}">${l.nombre}</option>`).join("");

function mensaje(texto, esError = false) {
  info.textContent = texto;
  info.className = esError ? "error" : "";
}

function limpiarRuta() {
  if (capaRuta) { map.removeLayer(capaRuta); capaRuta = null; }
  mensaje("");
}

function formatoDistancia(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function formatoTiempo(s) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

async function trazarRuta() {
  if (selDestino.value === "") return mensaje("Elige un destino.", true);

  // Punto de partida
  let origen;
  if (selOrigen.value === "gps") {
    mensaje("Buscando tu ubicación…");
    try {
      origen = await obtenerUbicacion();
    } catch (e) {
      return mensaje("No pude obtener tu ubicación. Elige un punto de partida de la lista.", true);
    }
    if (map.distance([origen.lat, origen.lng], CENTRO) > 8000) {
      return mensaje("Estás lejos de Turmequé. Elige un punto de partida de la lista.", true);
    }
    mostrarYo(origen);
  } else {
    origen = marcadores[selOrigen.value].getLatLng();
  }

  const destino = marcadores[selDestino.value].getLatLng();
  if (selOrigen.value === selDestino.value) {
    return mensaje("El origen y el destino son el mismo lugar.", true);
  }

  const modo = document.querySelector('input[name="modo"]:checked').value; // foot | car
  const perfil = modo === "foot" ? "routed-foot/route/v1/foot" : "routed-car/route/v1/driving";
  const url = `https://routing.openstreetmap.de/${perfil}/`
    + `${origen.lng},${origen.lat};${destino.lng},${destino.lat}`
    + `?overview=full&geometries=geojson`;

  mensaje("Calculando ruta…");
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error("Sin ruta");
    const ruta = data.routes[0];

    if (capaRuta) map.removeLayer(capaRuta);
    capaRuta = L.geoJSON(ruta.geometry, {
      style: { color: "#1565c0", weight: 6, opacity: 0.85 },
      interactive: false
    }).addTo(map);
    map.fitBounds(capaRuta.getBounds(), { padding: [60, 60] });

    const icono = modo === "foot" ? "🚶" : "🚗";
    mensaje(`${icono} ${formatoDistancia(ruta.distance)} · ${formatoTiempo(ruta.duration)}`);
  } catch (e) {
    console.warn(e);
    mensaje("No se pudo calcular la ruta. Intenta de nuevo en unos segundos.", true);
  }
}

// Botón "Ir aquí" dentro de cada marcador
function irA(i) {
  selDestino.value = String(i);
  map.closePopup();
  trazarRuta();
}

document.getElementById("btn-ruta").addEventListener("click", trazarRuta);
document.getElementById("btn-limpiar").addEventListener("click", limpiarRuta);

// Minimizar / abrir el panel
document.getElementById("btn-panel").addEventListener("click", () => {
  const panel = document.getElementById("panel");
  panel.classList.toggle("minimizado");
  document.getElementById("btn-panel").textContent =
    panel.classList.contains("minimizado") ? "+" : "−";
});