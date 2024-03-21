import React, { useEffect, useState } from "react";
import axios from 'axios';
import './styles.css'; // Import the CSS file for styles

function App() {
  const CLIENT_ID = "2748134a2e6a442780c62d3a01704707";
  const CLIENT_SECRET = "7baff294d818424e8bc335337c414b8f";
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

  const getUserTopTracks = async () => {
    try {
      let offset = 0;
      let limit = 50; // Maximum limit per request
      let tracks = [];
  
      while (offset < 20) { // Maximum 100 tracks
        const { data } = await axios.get("https://api.spotify.com/v1/me/top/tracks", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            limit: 100, // Adjust limit as needed
            offset: offset
          }
        });
  
        // Filter out tracks with null IDs
        const validTracks = data.items.filter(track => track.id);
  
        // Fetch audio features for the valid track IDs
        const trackIds = validTracks.map(track => track.id);
        const { data: audioFeatures } = await axios.get("https://api.spotify.com/v1/audio-features", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            ids: trackIds.join(',')
          }
        });
        
  
        // Combine valid track data with audio features
        const tracksWithAudioFeatures = validTracks.map(track => {
          const trackAudioFeatures = audioFeatures.audio_features.find(feature => feature && feature.id === track.id);
          const audioFeaturesData = trackAudioFeatures || {
            danceability: 0,
            energy: 0,
            instrumentalness: 0,
            tempo: 0,
            mode: 0,
            valence: 0
          };
          return { ...track, audio_features: audioFeaturesData }; // Ensure audio_features is an object
        });
  
        tracks = tracks.concat(tracksWithAudioFeatures);
  
        // If the number of tracks received is less than the limit, it means we've reached the end
        if (data.items.length < limit) {
          break;
        }
  
        offset += limit;
      }
  
      setTopTracks(tracks);
      calculateAverageAudioFeatures(tracks); // Calculate average audio features after getting top tracks
      getUserProfile(); // Fetch user profile after getting top tracks
    } catch (error) {
      console.error("Error fetching top tracks:", error);
      // Handle error
    }
  };
  
  
  
  

  const calculateAverageAudioFeatures = (tracks) => {
    const numTracks = tracks.length;
    const totalAudioFeatures = {
      danceability: 0,
      energy: 0,
      instrumentalness: 0,
      tempo: 0,
      mode: 0,
      valence: 0
    };

    tracks.forEach(track => {
      if (track.audio_features) {
        totalAudioFeatures.danceability += track.audio_features.danceability || 0;
        totalAudioFeatures.energy += track.audio_features.energy || 0;
        totalAudioFeatures.instrumentalness += track.audio_features.instrumentalness || 0;
        totalAudioFeatures.tempo += track.audio_features.tempo || 0;
        totalAudioFeatures.mode += track.audio_features.mode || 0;
        totalAudioFeatures.valence += track.audio_features.valence || 0;
      }
    });

    const averageAudioFeatures = {
      danceability: totalAudioFeatures.danceability / numTracks,
      energy: totalAudioFeatures.energy / numTracks,
      instrumentalness: totalAudioFeatures.instrumentalness / numTracks,
      tempo: totalAudioFeatures.tempo / numTracks,
      mode: totalAudioFeatures.mode / numTracks,
      valence: totalAudioFeatures.valence / numTracks
    };

    setAverageAudioFeatures(averageAudioFeatures);
  };

  const renderArtists = () => {
    return (
      <div className="search-results">
        {artists.map((artist) => (
          <div key={artist.id} className="artist-item">
            {token && artist.images.length > 0 && (

              <img src={artist.images[0].url} alt={artist.name} className="artist-image" />
            )}
            <div className="artist-details">
              {token && <div className="artist-name">{artist.name}</div>}
              {token && artist.genres.length > 0 && (
                <div className="artist-genres">Genres: {artist.genres.join(", ")}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderProfile = () => {
    if (!userProfile) return null;
    return (
      <div className="user-profile">
        {token && userProfile.images.length > 0 && (
          <img src={userProfile.images[0].url} alt="User" className="user-image" />
        )}
        <div className="user-details">
          {token && <div className="display-name">{userProfile.display_name}</div>}
          {userProfile.country && <div className="country">Country: {userProfile.country}</div>}
        </div>
      </div>
    );
  };
  const renderTopTracks = () => {
    return (
      <div className="top-tracks">
        {/* Display average audio features */}
        {averageAudioFeatures && (
          <div className="average-features-box">
            <h2>Average Audio Features</h2>
            <div>Danceability: {averageAudioFeatures.danceability}</div>
            <div>Energy: {averageAudioFeatures.energy}</div>
            <div>Instrumentalness: {averageAudioFeatures.instrumentalness}</div>
            <div>Tempo: {averageAudioFeatures.tempo}</div>
            <div>Mode: {averageAudioFeatures.mode}</div>
            <div>Valence: {averageAudioFeatures.valence}</div>
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
              <div className="track-audio-features">
                <div>Danceability: {track.audio_features.danceability}</div>
                <div>Energy: {track.audio_features.energy}</div>
                <div>Instrumentalness: {track.audio_features.instrumentalness}</div>
                <div>Tempo: {track.audio_features.tempo}</div>
                <div>Mode: {track.audio_features.mode}</div>
                <div>Valence: {track.audio_features.valence}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  
  
  return (
    <div className="container">
      <header className="App-header">
        <h1 className="neon-glow">SpotiPsych</h1>
        {token ? (
          <>
            <form className="search-form" onSubmit={searchArtists}>
              <input className="search-input" type="text" onChange={(e) => setSearchKey(e.target.value)} />
              <button type="submit" className="search-button">Search</button>
            </form>
            {/* <button className="get-profile-button" onClick={getUserProfile}>Get Profile</button> */}
            <button className="get-tracks-button" onClick={getUserTopTracks}>Get Top 100 Tracks</button>
            {renderProfile()}
            {renderArtists()}
            {renderTopTracks()}
            <button className="logout-button" onClick={logout}>Logout</button>
          </>
        ) : (
          <a
            href={`${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPES.join(
              "%20"
            )}`}
            className="login-button"
          >
            Login to Spotify
          </a>
        )}
      </header>
    </div>
  );
}

export default App
