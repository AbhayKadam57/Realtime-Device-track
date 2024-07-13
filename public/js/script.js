const socket = io();
let apiKey = ""; // Variable to store the API key
let userLocation = null; // Variable to store user's current location

let users = {};

// Listen for the API key from the server
socket.on("api-key", (data) => {
  apiKey = data.key;
});

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      userLocation = [latitude, longitude]; // Update user location
      socket.emit("send-location", { latitude, longitude }); // Send location to server
    },
    (error) => {
      console.log(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    }
  );
}

const map = L.map("map").setView([19.076, 72.8777], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "OpenStreetMap",
}).addTo(map);

let currentRoutePolyline = null;
let startMarker = null;
let endMarker = null;

async function getRoute(start, end) {
  const response = await fetch(
    `http://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
  );
  const data = await response.json();
  return data.routes[0].geometry.coordinates.map((coord) => [
    coord[1],
    coord[0],
  ]);
}

async function getCoordinates(city) {
  const response = await fetch(
    `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
      city
    )}&key=${apiKey}`
  );
  const data = await response.json();
  if (data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry;
    return [lat, lng];
  } else {
    throw new Error(`No coordinates found for city: ${city}`);
  }
}

document
  .getElementById("routeForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const startCity = document.getElementById("startCity").value;
    const endCity = document.getElementById("endCity").value;

    if (!endCity) {
      alert("End city is required.");
      return;
    }

    try {
      const start = startCity ? await getCoordinates(startCity) : userLocation;
      if (!start) {
        alert("Start location is not available.");
        return;
      }

      const end = await getCoordinates(endCity);

      if (currentRoutePolyline) {
        map.removeLayer(currentRoutePolyline);
      }
      if (startMarker) {
        map.removeLayer(startMarker);
      }
      if (endMarker) {
        map.removeLayer(endMarker);
      }

      startMarker = L.marker(start, { color: "green" })
        .addTo(map)
        .bindPopup("Start: " + (startCity || "Current Location"));
      endMarker = L.marker(end, { color: "red" })
        .addTo(map)
        .bindPopup("End: " + endCity);

      getRoute(start, end).then((route) => {
        currentRoutePolyline = L.polyline(route, { color: "blue" }).addTo(map);
        map.fitBounds(currentRoutePolyline.getBounds());
      });
    } catch (error) {
      alert(error.message);
    }
  });

socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;

  if (!users[id]) {
    const marker = L.marker([latitude, longitude]).addTo(map);
    const positions = [[latitude, longitude]];
    const polyline = L.polyline(positions, { color: "blue" }).addTo(map);
    users[id] = { marker, positions, polyline };
  } else {
    users[id].positions.push([latitude, longitude]);
    users[id].marker.setLatLng([latitude, longitude]);
    users[id].polyline.setLatLngs(users[id].positions);
  }

  map.setView([latitude, longitude]);
});

socket.on("user-disconnect", (id) => {
  if (users[id]) {
    map.removeLayer(users[id].marker);
    map.removeLayer(users[id].polyline);
    delete users[id];
  }
});
