import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, Clock, Fuel } from 'lucide-react';

const FlightOptimizer = () => {
  // Major US airports with coordinates
  const airports = {
    'JFK': { name: 'New York JFK', lat: 40.6413, lng: -73.7781, x: 720, y: 280 },
    'LAX': { name: 'Los Angeles', lat: 33.9416, lng: -118.4085, x: 150, y: 350 },
    'ORD': { name: 'Chicago O\'Hare', lat: 41.9742, lng: -87.9073, x: 580, y: 250 },
    'DFW': { name: 'Dallas/Fort Worth', lat: 32.8998, lng: -97.0403, x: 450, y: 420 },
    'DEN': { name: 'Denver', lat: 39.8561, lng: -104.6737, x: 320, y: 300 },
    'ATL': { name: 'Atlanta', lat: 33.6407, lng: -84.4277, x: 650, y: 420 },
    'SFO': { name: 'San Francisco', lat: 37.6213, lng: -122.3790, x: 100, y: 300 },
    'MIA': { name: 'Miami', lat: 25.7959, lng: -80.2870, x: 700, y: 520 },
    'SEA': { name: 'Seattle', lat: 47.4502, lng: -122.3088, x: 120, y: 150 },
    'BOS': { name: 'Boston', lat: 42.3656, lng: -71.0096, x: 750, y: 250 },
  };

  const generateRoutes = () => {
    const routes = [];
    const connections = {
      'JFK': ['BOS', 'ORD', 'ATL', 'MIA'],
      'LAX': ['SFO', 'DEN', 'DFW'],
      'ORD': ['JFK', 'DEN', 'DFW', 'ATL', 'SEA'],
      'DFW': ['LAX', 'ORD', 'DEN', 'ATL', 'MIA'],
      'DEN': ['LAX', 'ORD', 'DFW', 'SFO', 'SEA'],
      'ATL': ['JFK', 'ORD', 'DFW', 'MIA'],
      'SFO': ['LAX', 'DEN', 'SEA'],
      'MIA': ['JFK', 'ATL', 'DFW'],
      'SEA': ['SFO', 'DEN', 'ORD'],
      'BOS': ['JFK'],
    };

    Object.entries(connections).forEach(([from, toList]) => {
      toList.forEach(to => {
        const a1 = airports[from];
        const a2 = airports[to];
        const distance = Math.sqrt(Math.pow(a1.x - a2.x, 2) + Math.pow(a1.y - a2.y, 2));
        
        routes.push({
          from,
          to,
          distance: distance,
          time: distance * 0.8,
          fuel: distance * 1.2,
        });
      });
    });

    return routes;
  };

  const [routes] = useState(generateRoutes());
  const [origin, setOrigin] = useState('LAX');
  const [destination, setDestination] = useState('JFK');
  const [algorithm, setAlgorithm] = useState('dijkstra');
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [congestionEnabled, setCongestionEnabled] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const animationRef = useRef(null);

  const dijkstra = (start, end, routeNetwork) => {
    const distances = {};
    const previous = {};
    const unvisited = new Set(Object.keys(airports));
    
    Object.keys(airports).forEach(code => {
      distances[code] = Infinity;
      previous[code] = null;
    });
    distances[start] = 0;

    while (unvisited.size > 0) {
      let current = null;
      let minDist = Infinity;
      
      unvisited.forEach(code => {
        if (distances[code] < minDist) {
          minDist = distances[code];
          current = code;
        }
      });

      if (current === end) break;
      if (distances[current] === Infinity) break;

      unvisited.delete(current);

      const neighbors = routeNetwork.filter(r => r.from === current);
      neighbors.forEach(route => {
        const alt = distances[current] + route.distance;
        if (alt < distances[route.to]) {
          distances[route.to] = alt;
          previous[route.to] = current;
        }
      });
    }

    const path = [];
    let current = end;
    while (current) {
      path.unshift(current);
      current = previous[current];
    }

    return path.length > 1 ? path : null;
  };

  const aStar = (start, end, routeNetwork) => {
    const heuristic = (a, b) => {
      const a1 = airports[a];
      const a2 = airports[b];
      return Math.sqrt(Math.pow(a1.x - a2.x, 2) + Math.pow(a1.y - a2.y, 2));
    };

    const openSet = new Set([start]);
    const cameFrom = {};
    const gScore = {};
    const fScore = {};

    Object.keys(airports).forEach(code => {
      gScore[code] = Infinity;
      fScore[code] = Infinity;
    });
    gScore[start] = 0;
    fScore[start] = heuristic(start, end);

    while (openSet.size > 0) {
      let current = null;
      let minF = Infinity;
      
      openSet.forEach(code => {
        if (fScore[code] < minF) {
          minF = fScore[code];
          current = code;
        }
      });

      if (current === end) {
        const path = [];
        while (current) {
          path.unshift(current);
          current = cameFrom[current];
        }
        return path;
      }

      openSet.delete(current);

      const neighbors = routeNetwork.filter(r => r.from === current);
      neighbors.forEach(route => {
        const tentativeG = gScore[current] + route.distance;
        if (tentativeG < gScore[route.to]) {
          cameFrom[route.to] = current;
          gScore[route.to] = tentativeG;
          fScore[route.to] = tentativeG + heuristic(route.to, end);
          openSet.add(route.to);
        }
      });
    }

    return null;
  };

  const calculateNaivePath = () => {
    const a1 = airports[origin];
    const a2 = airports[destination];
    const distance = Math.sqrt(Math.pow(a1.x - a2.x, 2) + Math.pow(a1.y - a2.y, 2));
    
    return {
      distance: distance,
      time: distance * 0.8,
      fuel: distance * 1.2,
    };
  };

  const calculatePath = () => {
    let adjustedRoutes = routes.map(r => ({ ...r }));

    if (weatherEnabled) {
      adjustedRoutes = adjustedRoutes.map(r => {
        if (r.from === 'DEN' || r.to === 'DEN' || r.from === 'ORD' || r.to === 'ORD') {
          return { ...r, distance: r.distance * 1.3, time: r.time * 1.4, fuel: r.fuel * 1.3 };
        }
        return r;
      });
    }

    if (congestionEnabled) {
      adjustedRoutes = adjustedRoutes.map(r => {
        if (r.from === 'ATL' || r.to === 'ATL' || r.from === 'JFK' || r.to === 'JFK') {
          return { ...r, time: r.time * 1.25 };
        }
        return r;
      });
    }

    const path = algorithm === 'dijkstra' 
      ? dijkstra(origin, destination, adjustedRoutes)
      : aStar(origin, destination, adjustedRoutes);

    if (!path) return null;

    let totalDistance = 0;
    let totalTime = 0;
    let totalFuel = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const route = adjustedRoutes.find(r => r.from === path[i] && r.to === path[i + 1]);
      if (route) {
        totalDistance += route.distance;
        totalTime += route.time;
        totalFuel += route.fuel;
      }
    }

    const naive = calculateNaivePath();

    return {
      path,
      distance: totalDistance,
      time: totalTime,
      fuel: totalFuel,
      naive,
      distanceSaved: ((naive.distance - totalDistance) / naive.distance * 100).toFixed(1),
      timeSaved: ((naive.time - totalTime) / naive.time * 100).toFixed(1),
      fuelSaved: ((naive.fuel - totalFuel) / naive.fuel * 100).toFixed(1),
    };
  };

  const startAnimation = () => {
    const pathResult = calculatePath();
    if (!pathResult) return;

    setResult(pathResult);
    setAnimating(true);
    setProgress(0);

    const duration = 3000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / duration, 1);
      
      setProgress(newProgress);

      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const resetAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setAnimating(false);
    setProgress(0);
    setResult(null);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const drawPath = () => {
    if (!result || !result.path) return null;

    const segments = [];
    const path = result.path;

    for (let i = 0; i < path.length - 1; i++) {
      const from = airports[path[i]];
      const to = airports[path[i + 1]];
      
      const segmentProgress = Math.max(0, Math.min(1, (progress * path.length) - i));
      const x = from.x + (to.x - from.x) * segmentProgress;
      const y = from.y + (to.y - from.y) * segmentProgress;

      segments.push(
        <g key={`segment-${i}`}>
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#3b82f6"
            strokeWidth="3"
            opacity="0.3"
            strokeDasharray="5,5"
          />
          {segmentProgress > 0 && (
            <line
              x1={from.x}
              y1={from.y}
              x2={x}
              y2={y}
              stroke="#3b82f6"
              strokeWidth="3"
            />
          )}
        </g>
      );
    }

    if (progress > 0 && progress < 1) {
      const segmentIndex = Math.floor(progress * (path.length - 1));
      const segmentProgress = (progress * (path.length - 1)) - segmentIndex;
      const from = airports[path[segmentIndex]];
      const to = airports[path[segmentIndex + 1]];
      const planeX = from.x + (to.x - from.x) * segmentProgress;
      const planeY = from.y + (to.y - from.y) * segmentProgress;

      segments.push(
        <circle
          key="plane"
          cx={planeX}
          cy={planeY}
          r="6"
          fill="#ef4444"
          stroke="white"
          strokeWidth="2"
        >
          <animate
            attributeName="r"
            values="6;8;6"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      );
    }

    return segments;
  };

  const styles = {
    container: {
      width: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #0f172a, #1e293b)',
      color: 'white',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    maxWidth: {
      maxWidth: '1280px',
      margin: '0 auto',
    },
    title: {
      fontSize: '36px',
      fontWeight: 'bold',
      marginBottom: '8px',
      textAlign: 'center',
      background: 'linear-gradient(to right, #60a5fa, #22d3ee)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    subtitle: {
      color: '#94a3b8',
      textAlign: 'center',
      marginBottom: '24px',
    },
    gridContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '24px',
      marginBottom: '24px',
    },
    gridLarge: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: '24px',
      marginBottom: '24px',
    },
    card: {
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
    },
    cardSmall: {
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
    },
    svg: {
      width: '100%',
      height: 'auto',
      border: '1px solid #334155',
      borderRadius: '8px',
      backgroundColor: '#0f172a',
    },
    heading: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    label: {
      display: 'block',
      fontSize: '14px',
      color: '#94a3b8',
      marginBottom: '4px',
    },
    select: {
      width: '100%',
      backgroundColor: '#334155',
      border: '1px solid #475569',
      borderRadius: '4px',
      padding: '8px 12px',
      color: 'white',
      fontSize: '14px',
    },
    checkbox: {
      width: '16px',
      height: '16px',
      cursor: 'pointer',
    },
    buttonPrimary: {
      flex: 1,
      backgroundColor: '#2563eb',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '4px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'background-color 0.2s',
    },
    buttonSecondary: {
      backgroundColor: '#334155',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
    buttonDisabled: {
      backgroundColor: '#475569',
      cursor: 'not-allowed',
    },
    resultCard: {
      backgroundColor: '#334155',
      borderRadius: '8px',
      padding: '12px',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '8px',
    },
    statBox: {
      backgroundColor: '#334155',
      borderRadius: '8px',
      padding: '8px',
      textAlign: 'center',
    },
    legend: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      fontSize: '12px',
      color: '#94a3b8',
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    dot: {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
    },
    line: {
      width: '32px',
      height: '2px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        <h1 style={styles.title}>
          Flight Path Optimization Simulator
        </h1>
        <p style={styles.subtitle}>Visualize efficient routing with Dijkstra & A* algorithms</p>

        <div style={window.innerWidth > 1024 ? styles.gridLarge : styles.gridContainer}>
          <div style={styles.card}>
            <svg width="800" height="600" style={styles.svg}>
              {routes.map((route, i) => {
                const from = airports[route.from];
                const to = airports[route.to];
                const isWeatherAffected = weatherEnabled && (route.from === 'DEN' || route.to === 'DEN' || route.from === 'ORD' || route.to === 'ORD');
                const isCongested = congestionEnabled && (route.from === 'ATL' || route.to === 'ATL' || route.from === 'JFK' || route.to === 'JFK');
                
                return (
                  <line
                    key={i}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isWeatherAffected ? '#f59e0b' : isCongested ? '#ef4444' : '#475569'}
                    strokeWidth="1.5"
                    opacity={isWeatherAffected || isCongested ? '0.6' : '0.3'}
                  />
                );
              })}

              {drawPath()}

              {Object.entries(airports).map(([code, airport]) => {
                const isOrigin = code === origin;
                const isDestination = code === destination;
                const isOnPath = result?.path?.includes(code);
                
                return (
                  <g key={code}>
                    <circle
                      cx={airport.x}
                      cy={airport.y}
                      r={isOrigin || isDestination ? '10' : '6'}
                      fill={isOrigin ? '#10b981' : isDestination ? '#ef4444' : isOnPath ? '#3b82f6' : '#64748b'}
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text
                      x={airport.x}
                      y={airport.y - 15}
                      textAnchor="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      {code}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div>
            <div style={styles.cardSmall}>
              <h3 style={styles.heading}>
                <Zap size={20} color="#facc15" />
                Route Configuration
              </h3>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>Origin</label>
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  style={styles.select}
                >
                  {Object.entries(airports).map(([code, airport]) => (
                    <option key={code} value={code}>{code} - {airport.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>Destination</label>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  style={styles.select}
                >
                  {Object.entries(airports).map(([code, airport]) => (
                    <option key={code} value={code}>{code} - {airport.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>Algorithm</label>
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value)}
                  style={styles.select}
                >
                  <option value="dijkstra">Dijkstra (Shortest Path)</option>
                  <option value="astar">A* (Heuristic-based)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <input
                  type="checkbox"
                  id="weather"
                  checked={weatherEnabled}
                  onChange={(e) => setWeatherEnabled(e.target.checked)}
                  style={styles.checkbox}
                />
                <label htmlFor="weather" style={{ fontSize: '14px' }}>Bad Weather (DEN, ORD) +30% cost</label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <input
                  type="checkbox"
                  id="congestion"
                  checked={congestionEnabled}
                  onChange={(e) => setCongestionEnabled(e.target.checked)}
                  style={styles.checkbox}
                />
                <label htmlFor="congestion" style={{ fontSize: '14px' }}>Congestion (ATL, JFK) +25% time</label>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={startAnimation}
                  disabled={animating || origin === destination}
                  style={{
                    ...styles.buttonPrimary,
                    ...(animating || origin === destination ? styles.buttonDisabled : {}),
                  }}
                  onMouseOver={(e) => !animating && origin !== destination && (e.target.style.backgroundColor = '#1d4ed8')}
                  onMouseOut={(e) => !animating && origin !== destination && (e.target.style.backgroundColor = '#2563eb')}
                >
                  {animating ? <Pause size={16} /> : <Play size={16} />}
                  {animating ? 'Running' : 'Optimize Route'}
                </button>
                <button
                  onClick={resetAnimation}
                  style={styles.buttonSecondary}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#475569'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#334155'}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {result && (
              <div style={{ ...styles.cardSmall, marginTop: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Results</h3>
                
                <div style={styles.resultCard}>
                  <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>Optimized Route</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#22d3ee' }}>
                    {result.path.join(' → ')}
                  </div>
                </div>

                <div style={{ ...styles.statsGrid, marginTop: '12px' }}>
                  <div style={styles.statBox}>
                    <Clock size={16} color="#60a5fa" style={{ margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Time Saved</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>{result.timeSaved}%</div>
                  </div>
                  <div style={styles.statBox}>
                    <Fuel size={16} color="#fb923c" style={{ margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Fuel Saved</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>{result.fuelSaved}%</div>
                  </div>
                  <div style={styles.statBox}>
                    <Zap size={16} color="#facc15" style={{ margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Dist. Saved</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>{result.distanceSaved}%</div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#94a3b8', backgroundColor: '#334155', borderRadius: '8px', padding: '8px', marginTop: '12px' }}>
                  <div>Distance: {result.distance.toFixed(0)} vs {result.naive.distance.toFixed(0)} (naive)</div>
                  <div>Time: {result.time.toFixed(0)} vs {result.naive.time.toFixed(0)} (naive)</div>
                  <div>Fuel: {result.fuel.toFixed(0)} vs {result.naive.fuel.toFixed(0)} (naive)</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={styles.cardSmall}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#cbd5e1' }}>Legend</h3>
          <div style={styles.legend}>
            <div style={styles.legendItem}>
              <div style={{ ...styles.dot, backgroundColor: '#10b981' }}></div>
              <span>Origin</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{ ...styles.dot, backgroundColor: '#ef4444' }}></div>
              <span>Destination</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{ ...styles.dot, backgroundColor: '#3b82f6' }}></div>
              <span>Route Node</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{ ...styles.line, backgroundColor: '#f59e0b' }}></div>
              <span>Bad Weather</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{ ...styles.line, backgroundColor: '#ef4444' }}></div>
              <span>Congested</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{ ...styles.line, backgroundColor: '#3b82f6' }}></div>
              <span>Optimized Path</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightOptimizer;