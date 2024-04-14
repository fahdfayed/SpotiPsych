import React, { useEffect, useState } from "react";
import axios from 'axios';
import './styles.css'; // Import the CSS file for styles

function App() {
  const CLIENT_ID = "9d66ede257664a81b25946cf8cc429a8";
  const CLIENT_SECRET = "e5255ea8b36d4dcabcc9c7c5906b12d8";
  const REDIRECT_URI = "https://spoti-psych.vercel.app/callback";
  const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
  const RESPONSE_TYPE = "code";
  const SCOPES = ["user-read-email", "user-read-private", "user-top-read"];

  const [token, setToken] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [artists, setArtists] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [averageAudioFeatures, setAverageAudioFeatures] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      // If authorization code is received, exchange it for access token
      exchangeCodeForToken(code);
    } else {
      // Clear token from state if no authorization code is present
      setToken("");
      // Check if the user is already logged in
      const storedToken = window.localStorage.getItem("token");
      if (storedToken) {
        setToken(storedToken);
        // Only fetch user profile if token is not empty
        if (storedToken !== "") {
          getUserProfile();
        }
      } else {
        // Redirect user to Spotify login page if not logged in
        window.location.href = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPES.join("%20")}`;
      }
    }
  }, []);

  const exchangeCodeForToken = async (code) => {
    try {
      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI, // Ensure this matches the redirect URI in your Spotify Developer Dashboard
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      const token = response.data.access_token;
      setToken(token);
      window.localStorage.setItem("token", token);
    } catch (error) {
      console.error("Error exchanging code for token:", error);
    }
  };

  const logout = () => {
    setToken("");
    window.localStorage.removeItem("token");
    window.location.href = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPES.join("%20")}`;
  };

  const searchArtists = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          q: searchKey,
          type: "artist",
        },
      });
      setArtists(data.artists.items);
    } catch (error) {
      console.error("Error searching artists:", error);
    }
  };

  const getUserProfile = async () => {
    try {
      const { data } = await axios.get("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUserProfile(data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

// Update the getUserTopTracks function to fetch track popularity
const getUserTopTracks = async () => {
  try {
    let offset = 0;
    let limit = 50; // Maximum limit per request
    let tracks = [];

    while (offset < 100) { // Fetch 100 tracks
      const { data } = await axios.get("https://api.spotify.com/v1/me/top/tracks", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          limit: Math.min(limit, 100 - offset), // Ensure limit doesn't exceed remaining tracks
          offset: offset,
          time_range: "long_term"
        }
      });

      // Fetch track details including popularity
      const trackDetails = await Promise.all(
        data.items.map(async (track) => {
          const response = await axios.get(`https://api.spotify.com/v1/tracks/${track.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          return response.data;
        })
      );

      tracks = tracks.concat(trackDetails);

      // If the number of tracks received is less than the limit, it means we've reached the end
      if (data.items.length < limit || tracks.length >= 100) {
        break;
      }

      offset += limit;
    }

    setTopTracks(tracks);
    calculateAverageAudioFeatures(tracks); // Calculate average audio features and popularity after getting top tracks
    getUserProfile(); // Fetch user profile after getting top tracks
  } catch (error) {
    console.error("Error fetching top tracks:", error);
    // Handle error
  }
};

// Extend the calculateAverageAudioFeatures function to calculate average popularity
const calculateAverageAudioFeatures = (tracks) => {
  const numTracks = tracks.length;
  const totalAudioFeatures = {
    danceability: 0,
    energy: 0,
    instrumentalness: 0,
    tempo: 0,
    mode: 0,
    valence: 0,
    popularity: 0, // Add popularity to total
  };

  tracks.forEach((track) => {
    totalAudioFeatures.danceability += track.audio_features.danceability || 0;
    totalAudioFeatures.energy += track.audio_features.energy || 0;
    totalAudioFeatures.instrumentalness += track.audio_features.instrumentalness || 0;
    totalAudioFeatures.tempo += track.audio_features.tempo || 0;
    totalAudioFeatures.mode += track.audio_features.mode || 0;
    totalAudioFeatures.valence += track.audio_features.valence || 0;
    totalAudioFeatures.popularity += track.popularity || 0; // Add popularity to total
  });

  const averageAudioFeatures = {
    danceability: totalAudioFeatures.danceability / numTracks,
    energy: totalAudioFeatures.energy / numTracks,
    instrumentalness: totalAudioFeatures.instrumentalness / numTracks,
    tempo: totalAudioFeatures.tempo / numTracks,
    mode: totalAudioFeatures.mode / numTracks,
    valence: totalAudioFeatures.valence / numTracks,
    popularity: totalAudioFeatures.popularity / numTracks, // Calculate average popularity
  };

  setAverageAudioFeatures(averageAudioFeatures);
};

// Update the renderTopTracks function to display popularity
const renderTopTracks = () => {
  return (
    <div className="top-tracks">
      {/* Display average audio features and popularity */}
      {averageAudioFeatures && (
        <div className="average-features-box">
          <h2>Average Audio Features</h2>
          <div>Danceability: {averageAudioFeatures.danceability.toFixed(5)}</div>
          <div>Energy: {averageAudioFeatures.energy.toFixed(5)}</div>
          <div>Instrumentalness: {averageAudioFeatures.instrumentalness.toFixed(5)}</div>
          <div>Tempo: {averageAudioFeatures.tempo.toFixed(5)}</div>
          <div>Mode: {averageAudioFeatures.mode.toFixed(5)}</div>
          <div>Valence: {averageAudioFeatures.valence.toFixed(5)}</div>
          <div>Popularity: {averageAudioFeatures.popularity.toFixed(5)}</div> {/* Display average popularity */}
        </div>
      )}

      {/* Display individual tracks */}
      {topTracks.map((track) => (
        <div key={track.id} className="track-card">
          <div className="track-image-container">
            <img src={track.album.images[0].url} alt={track.name} className="track-image" />
          </div>
          <div className="track-details">
            <div className="track-name">{track.name}</div>
            <div className="track-artists">
              Artists: {track.artists.map((artist) => artist.name).join(", ")}
            </div>
            <div className="track-album">Album: {track.album.name}</div>
            <div className="track-release-date">Release Date: {track.album.release_date}</div>
            <div className="track-popularity">Popularity: {track.popularity}</div> {/* Display track popularity */}
            <div className="track-audio-features">
              <div>Danceability: {track.audio_features.danceability.toFixed(5)}</div>
              <div>Energy: {track.audio_features.energy.toFixed(5)}</div>
              <div>Instrumentalness: {track.audio_features.instrumentalness.toFixed(5)}</div>
              <div>Tempo: {track.audio_features.tempo.toFixed(5)}</div>
              <div>Mode: {track.audio_features.mode.toFixed(5)}</div>
              <div>Valence: {track.audio_features.valence.toFixed(5)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
}