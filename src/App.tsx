import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Thermometer, 
  Droplets, 
  MapPin, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Sprout,
  Wind,
  Layers,
  Cpu,
  ShieldCheck,
  Zap,
  Clock,
  ChevronRight,
  LogOut,
  LogIn,
  History,
  Database,
  BarChart3 as ChartIcon,
  Trash2,
  BrainCircuit,
  FileText,
  Download,
  AlertTriangle,
  Plus,
  MessageSquare,
  Activity as PulseIcon,
  Target,
  Menu,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from "./firebase";
import { doc, onSnapshot, collection, query, orderBy, limit, deleteDoc, getDocs, writeBatch, addDoc, serverTimestamp } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { analyzeSoilData } from "./services/geminiService";
import Markdown from 'react-markdown';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface SoilData {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  temperature: number;
  humidity: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  source?: string;
  lastPostTime?: string;
}

const validateValue = (val: any, isEnvironmental = false) => {
  if (val === undefined || val === null || val === 65535) return undefined;
  if (isEnvironmental && val === 0) return undefined;
  return Number(val);
};

const Gauge = ({ label, value, color, icon: Icon, delay = 0 }: { label: string, value: number | undefined, color: string, icon: any, delay?: number }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="space-y-4"
  >
    <div className="flex justify-between items-end">
      <div className="flex flex-col gap-1">
        <span className="serif-header">{label}</span>
        <div className="flex items-center gap-2">
          <Icon size={14} className={`${color} opacity-60`} />
          <span className="tech-label text-slate-400">Telemetry Stream</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="data-value text-2xl font-bold">
          {value !== undefined ? value.toFixed(1) : '---'}
        </span>
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">mg/kg</span>
      </div>
    </div>
    <div className="h-1 bg-slate-800/80 rounded-full overflow-hidden relative">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value || 0, 100)}%` }}
        className={`h-full rounded-full relative z-10 ${color.replace('text-', 'bg-')}`}
        transition={{ type: "spring", stiffness: 40, damping: 12, delay: delay + 0.2 }}
      />
    </div>
  </motion.div>
);

const SensorCard = ({ title, value, unit, icon: Icon, trend, color, delay = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-8 group relative flex flex-col justify-between min-h-[180px]"
  >
    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
      <Icon size={64} className={color} />
    </div>
    
    <div className="space-y-1">
      <span className="serif-header">{title}</span>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} opacity-50`} />
        <span className="tech-label">Active Sensor</span>
      </div>
    </div>
    
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-5xl font-black data-value">
          {value !== undefined && value !== null ? value.toFixed(1) : '---'}
        </h3>
        <span className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">{unit}</span>
      </div>
      
      <AnimatePresence mode="wait">
        {trend !== undefined && (
          <motion.div 
            key={trend}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] ${trend >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}
          >
            <div className={`p-1 rounded-sm ${trend >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            </div>
            <span>{Math.abs(trend ?? 0).toFixed(1)}% Variance</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </motion.div>
);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-10 text-center">
          <AlertTriangle className="text-rose-500 mb-6" size={64} />
          <h1 className="text-2xl font-black text-slate-100 mb-4 uppercase tracking-tighter">System Critical Error</h1>
          <div className="glass-card p-6 max-w-2xl w-full bg-rose-500/5 border-rose-500/20">
            <p className="text-rose-400 font-mono text-sm mb-4">
              {this.state.error?.message || "An unexpected error occurred in the telemetry stream."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-500 transition-all"
            >
              REBOOT SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState<SoilData | null>(null);
  const [prevData, setPrevData] = useState<SoilData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'intelligence' | 'logbook' | 'settings' | 'assistant' | 'control'>('overview');
  const [nightVision, setNightVision] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: "Systems online. I am your SoilGuard AI Assistant. How can I help you optimize your field today?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState('Field Alpha');
  const [irrigationActive, setIrrigationActive] = useState(false);
  const [fertilizerActive, setFertilizerActive] = useState(false);
  
  const [thresholds, setThresholds] = useState({
    nitrogen: { min: 20, max: 80 },
    phosphorus: { min: 20, max: 80 },
    potassium: { min: 20, max: 80 },
    temp: { min: 15, max: 35 },
    humidity: { min: 30, max: 80 }
  });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [newLog, setNewLog] = useState("");
  const [logType, setLogType] = useState<'observation' | 'action' | 'alert'>('observation');

  const [weather, setWeather] = useState({ temp: 24, condition: 'Sunny', humidity: 45 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  const [tacticalAdvice, setTacticalAdvice] = useState<string[]>([]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      }, (err) => {
        console.error("Geolocation error:", err);
        // Fallback to a default location or just skip
      });
    }
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!location) return;
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`);
        const data = await res.json();
        
        if (data.current_weather) {
          setWeather({
            temp: data.current_weather.temperature,
            condition: getWeatherCondition(data.current_weather.weathercode),
            humidity: weather.humidity // Open-Meteo current doesn't always have humidity in simple call
          });
        }

        if (data.daily) {
          const dailyForecast = data.daily.time.map((time: string, i: number) => ({
            date: time,
            maxTemp: data.daily.temperature_2m_max[i],
            minTemp: data.daily.temperature_2m_min[i],
            precip: data.daily.precipitation_sum[i],
            wind: data.daily.windspeed_10m_max[i],
            code: data.daily.weathercode[i]
          }));
          setForecast(dailyForecast);
          generateTacticalAdvice(dailyForecast);
        }
      } catch (err) {
        console.error("Weather fetch error:", err);
      }
    };

    fetchWeather();
  }, [location]);

  const getWeatherCondition = (code: number) => {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code <= 82) return 'Showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  const generateTacticalAdvice = (forecastData: any[]) => {
    const advice: string[] = [];
    const today = forecastData[0];
    const tomorrow = forecastData[1];

    if (today.precip > 5) {
      advice.push("Heavy rain detected: Disable all automated irrigation systems.");
    } else if (today.precip > 0) {
      advice.push("Light rain expected: Reduce irrigation duration by 50%.");
    } else if (today.maxTemp > 35) {
      advice.push("Extreme heat warning: Increase hydration and consider temporary shading.");
    }

    if (today.wind > 30) {
      advice.push("High wind speeds: Secure tall plants and check structural integrity of supports.");
    }

    if (tomorrow && tomorrow.precip > 10) {
      advice.push("Significant rain tomorrow: Postpone any planned fertilization to prevent runoff.");
    }

    if (today.minTemp < 5) {
      advice.push("Frost risk: Move sensitive container plants indoors or apply thermal covers.");
    }

    if (advice.length === 0) {
      advice.push("Optimal conditions: Maintain standard operational protocols.");
    }

    setTacticalAdvice(advice);
  };

  const calculateHealthScore = (d: SoilData) => {
    if (!d) return 0;
    const n = validateValue(d.nitrogen);
    const p = validateValue(d.phosphorus);
    const k = validateValue(d.potassium);
    const t = validateValue(d.temperature, true);
    const h = validateValue(d.humidity, true);

    if (n === undefined || p === undefined || k === undefined) return 0;

    const nScore = n >= thresholds.nitrogen.min && n <= thresholds.nitrogen.max ? 20 : 10;
    const pScore = p >= thresholds.phosphorus.min && p <= thresholds.phosphorus.max ? 20 : 10;
    const kScore = k >= thresholds.potassium.min && k <= thresholds.potassium.max ? 20 : 10;
    const tScore = t !== undefined && t >= thresholds.temp.min && t <= thresholds.temp.max ? 20 : 10;
    const hScore = h !== undefined && h >= thresholds.humidity.min && h <= thresholds.humidity.max ? 20 : 10;
    return nScore + pScore + kScore + tScore + hScore;
  };

  const runAiAnalysis = async () => {
    if (!data) return;
    setAnalyzing(true);
    const result = await analyzeSoilData({
      nitrogen: validateValue(data.nitrogen) || 0,
      phosphorus: validateValue(data.phosphorus) || 0,
      potassium: validateValue(data.potassium) || 0,
      temperature: validateValue(data.temperature, true) || 0,
      humidity: validateValue(data.humidity, true) || 0,
      weather: weather.condition,
      forecast: forecast.slice(0, 3).map(f => `${f.date}: ${f.condition || getWeatherCondition(f.code)}, Max ${f.maxTemp}°C, Precip ${f.precip}mm`).join('; ')
    });
    setAiAnalysis(result);
    setAnalyzing(false);
  };

  const exportToCSV = () => {
    const headers = ["Timestamp", "Nitrogen", "Phosphorus", "Potassium", "Temperature", "Humidity", "Source"];
    const rows = history.map(r => [
      r.timestamp,
      r.nitrogen,
      r.phosphorus,
      r.potassium,
      r.temperature,
      r.humidity,
      r.source
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `soil_data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newLog.trim()) return;
    const path = 'logs';
    try {
      await addDoc(collection(db, path), {
        content: newLog,
        type: logType,
        timestamp: new Date().toISOString(),
        userId: user.uid
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, path));
      setNewLog("");
    } catch (err) {
      console.error("Error adding log:", err);
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (!user) return;
    const path = `readings/${id}`;
    try {
      await deleteDoc(doc(db, 'readings', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, path));
    } catch (err) {
      console.error("Error deleting reading:", err);
    }
  };

  const handleClearHistory = async () => {
    if (!user) {
      alert("Authentication Required: Please sign in to clear history.");
      return;
    }
    if (!window.confirm("Are you sure you want to clear all history? This cannot be undone.")) return;
    try {
      const path = 'readings';
      const q = query(collection(db, path), limit(450));
      const snapshot = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.LIST, path));
      
      if (!snapshot || snapshot.empty) {
        alert("No readings found to clear.");
        return;
      }
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, path));
      
      if (snapshot.docs.length === 450) {
        alert(`Cleared ${snapshot.docs.length} readings. There are more records remaining; please click 'Clear All' again to continue.`);
      } else {
        alert(`Successfully cleared ${snapshot.docs.length} readings.`);
      }
    } catch (err: any) {
      console.error("Error clearing history:", err);
      let message = err.message;
      try {
        const parsed = JSON.parse(err.message);
        message = parsed.error;
      } catch (e) {}
      alert("Failed to clear history: " + message + "\n\nTip: Ensure you have 'delete' permissions in your Firestore rules.");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubLatest = onSnapshot(doc(db, 'latest', 'status'), (doc) => {
      if (doc.exists()) {
        const newData = doc.data() as SoilData;
        setPrevData(prev => prev || newData);
        setData(newData);
        setLoading(false);
      } else {
        fetchFallbackData();
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'latest/status');
      if (!data) {
        setError("Database connection error. Please sign in.");
        setLoading(false);
      }
    });

    const q = query(collection(db, 'readings'), orderBy('timestamp', 'desc'), limit(20));
    const unsubHistory = onSnapshot(q, (snapshot) => {
      const readings = snapshot.docs.map(doc => {
        const rawData = doc.data();
        // Handle both ISO strings and Firestore Timestamps
        const date = rawData.timestamp?.toDate ? rawData.timestamp.toDate() : new Date(rawData.timestamp);
        const isValidDate = date instanceof Date && !isNaN(date.getTime());
        
        return {
          ...rawData,
          id: doc.id,
          time: isValidDate ? date.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
          }) : 'Invalid Time',
          date: isValidDate ? date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
          }) : 'Invalid Date'
        };
      });
      setHistory(readings);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'readings');
    });

    const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logEntries);
    });

    return () => {
      unsubLatest();
      unsubHistory();
      unsubLogs();
    };
  }, []);

  const fetchFallbackData = async () => {
    try {
      const response = await fetch(`/api/data?t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const newData = await response.json();
      setData(newData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/popup-blocked') {
        alert("Sign-in popup was blocked! Please allow popups for this website in your browser settings and try again.");
      } else if (err.code === 'auth/cancelled-popup-request') {
      } else {
        alert("Login failed: " + err.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          { role: 'user', parts: [{ text: `You are the SoilGuard Pro AI Assistant. You have access to the following soil telemetry: ${JSON.stringify(data)}. The user says: ${userMessage}` }] }
        ]
      });
      const aiText = response.text || "I'm sorry, I couldn't process that request.";
      setChatMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (err) {
      console.error("Chat Error:", err);
      setChatMessages(prev => [...prev, { role: 'model', text: "Error: Uplink interrupted. Please check your API key and connection." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const generateSampleData = async () => {
    if (!user) {
      alert("Please sign in to generate sample data.");
      return;
    }
    const path = 'readings';
    try {
      const batch = writeBatch(db);
      for (let i = 0; i < 5; i++) {
        const docRef = doc(collection(db, path));
        batch.set(docRef, {
          nitrogen: Math.random() * 100,
          phosphorus: Math.random() * 100,
          potassium: Math.random() * 100,
          temperature: 20 + Math.random() * 10,
          humidity: 40 + Math.random() * 20,
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
          source: "Manual Seed"
        });
      }
      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, path));
      alert("Sample data generated successfully!");
    } catch (err) {
      console.error("Error generating sample data:", err);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-dark gap-6">
        <motion.div 
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            rotate: { repeat: Infinity, duration: 2, ease: "linear" },
            scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
          }}
          className="relative"
        >
          <RefreshCw className="text-emerald-400" size={64} />
          <div className="absolute inset-0 blur-xl bg-emerald-500/20 rounded-full" />
        </motion.div>
        <div className="text-center space-y-2">
          <h2 className="text-gradient text-xl">Initializing SoilGuard Pro</h2>
          <p className="tech-label animate-pulse">Establishing Secure Uplink...</p>
        </div>
      </div>
    );
  }

  const chartData = data ? [
    { name: 'N', value: validateValue(data.nitrogen), color: '#10b981', full: 'Nitrogen' },
    { name: 'P', value: validateValue(data.phosphorus), color: '#3b82f6', full: 'Phosphorus' },
    { name: 'K', value: validateValue(data.potassium), color: '#f59e0b', full: 'Potassium' },
  ] : [];

  const calculateTrend = (current: number, previous: number) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <ErrorBoundary>
      <div className={`min-h-screen flex ${nightVision ? 'bg-black text-rose-600' : 'bg-[#020617] text-slate-200'} transition-colors duration-500 relative overflow-hidden`}>
        {nightVision && <div className="scanline" />}
        
        {/* Sidebar */}
        <motion.aside 
          initial={false}
          animate={{ 
            width: sidebarOpen ? 288 : 0,
            opacity: sidebarOpen ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`flex-shrink-0 border-r flex flex-col ${nightVision ? 'bg-black border-rose-900/30' : 'bg-slate-950/50 border-slate-800/50'} backdrop-blur-xl z-50 overflow-hidden relative`}
        >
          <motion.div 
            animate={{ opacity: sidebarOpen ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="p-8 w-72 flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className={`p-3 rounded-2xl border ${nightVision ? 'bg-rose-950/20 border-rose-500/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}
                >
                  <Sprout className={nightVision ? 'text-rose-500' : 'text-emerald-500'} size={24} />
                </motion.div>
                <div>
                  <h1 className="text-xl font-black tracking-tighter leading-none mb-1 text-slate-100">SOILGUARD</h1>
                  <div className="flex items-center gap-2">
                    <div className={`w-1 h-1 rounded-full ${nightVision ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className={`tech-label text-[8px] ${nightVision ? 'text-rose-700' : 'text-slate-500'}`}>Tactical Command</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-slate-500 hover:text-white lg:hidden"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="space-y-2">
              {[
                { id: 'overview', label: 'Overview', icon: PulseIcon },
                { id: 'history', label: 'History', icon: History },
                { id: 'intelligence', label: 'AI Intel', icon: BrainCircuit },
                { id: 'assistant', label: 'Assistant', icon: MessageSquare },
                { id: 'control', label: 'Control', icon: Zap },
                { id: 'logbook', label: 'Logbook', icon: FileText },
                { id: 'settings', label: 'Config', icon: Cpu }
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full sidebar-item ${
                    activeTab === tab.id 
                      ? (nightVision ? 'sidebar-item-active-night' : 'sidebar-item-active') 
                      : (nightVision ? 'sidebar-item-inactive-night' : 'sidebar-item-inactive')
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="mt-auto p-8 space-y-6">
            <div className={`p-4 rounded-2xl border ${nightVision ? 'bg-rose-950/10 border-rose-900/30' : 'bg-slate-900/30 border-slate-800/50'}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="tech-label text-[8px]">Night Vision</span>
                <button 
                  onClick={() => setNightVision(!nightVision)}
                  className={`w-10 h-5 rounded-full relative transition-all ${nightVision ? 'bg-rose-500' : 'bg-slate-700'}`}
                >
                  <motion.div 
                    animate={{ x: nightVision ? 22 : 2 }}
                    className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="tech-label text-[8px]">Status</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${nightVision ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Online</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSidebarOpen(false)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${nightVision ? 'text-rose-900 hover:text-rose-400 hover:bg-rose-950/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
            >
              <ChevronRight className="rotate-180" size={18} />
              Collapse Sidebar
            </button>

            {user ? (
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900/50 transition-all border border-transparent hover:border-slate-800"
              >
                <LogOut size={14} />
                SIGN OUT
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
              >
                <LogIn size={14} />
                SIGN IN
              </button>
            )}
            </div>
          </motion.div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-grow overflow-y-auto relative">
          <header className={`sticky top-0 z-40 px-10 py-6 border-b backdrop-blur-md flex items-center justify-between ${nightVision ? 'bg-black/80 border-rose-900/30' : 'bg-[#020617]/80 border-slate-800/50'}`}>
            <div className="flex items-center gap-8">
              {!sidebarOpen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSidebarOpen(true)}
                  className={`p-2.5 rounded-xl border transition-all ${nightVision ? 'bg-rose-950/20 border-rose-900/50 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50'}`}
                >
                  <Menu size={20} />
                </motion.button>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="serif-header">Operational Sector</span>
                <span className="text-sm font-bold text-slate-100 uppercase tracking-widest">Alpha-7 Field</span>
              </div>
              <div className="w-px h-8 bg-slate-800/50" />
              <div className="flex flex-col gap-0.5">
                <span className="serif-header">Telemetry Source</span>
                <span className={`text-xs font-bold ${data?.source?.includes('Live') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data?.source || 'Simulated'}
                </span>
              </div>
              <div className="w-px h-8 bg-slate-800/50" />
              <div className="flex flex-col gap-0.5">
                <span className="serif-header">Last Synchronization</span>
                <span className="text-xs font-bold text-blue-400">
                  {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '---'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end mr-4">
                <span className="tech-label text-[8px]">Environment</span>
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  {window.location.hostname.includes('ais-pre') ? 'PRODUCTION' : 'DEVELOPMENT'}
                </span>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={fetchFallbackData}
                className={`p-2.5 rounded-xl border transition-all ${nightVision ? 'bg-rose-950/20 border-rose-900/50 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50'}`}
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </motion.button>
            </div>
          </header>

          <div className="p-10 max-w-[1400px] mx-auto">
            <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 xl:grid-cols-12 gap-8"
          >
            <div className="xl:col-span-8 space-y-8">
              <div className="glass-card p-10 relative group">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-blue-500 opacity-50" />
                
                <div className="flex items-center justify-between mb-12">
                  <div className="flex flex-col gap-1">
                    <span className="serif-header">Soil Composition Analysis</span>
                    <div className="flex items-center gap-3">
                      <Layers className="text-blue-400 opacity-60" size={20} />
                      <h2 className="text-xl font-bold text-slate-100 uppercase tracking-widest">Nutrient Profile</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="tech-label text-[8px]">Sector</span>
                      <span className="text-[10px] font-bold text-slate-400">ALPHA-7</span>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/50 rounded-xl border border-slate-800/50 shadow-inner">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="tech-label text-[9px]">Live Stream</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <div className="h-[350px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          {chartData.map((entry, index) => (
                            <linearGradient key={`grad-${index}`} id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={0.8}/>
                              <stop offset="100%" stopColor={entry.color} stopOpacity={0.2}/>
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} opacity={0.5} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#475569" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          dy={10}
                          fontWeight="bold"
                        />
                        <YAxis 
                          stroke="#475569" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          dx={-10}
                          fontWeight="bold"
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="glass-card p-4 border-slate-700 shadow-2xl">
                                  <p className="tech-label mb-1">{data.full}</p>
                                  <p className="text-xl font-mono font-black text-slate-100">{(data.value ?? 0).toFixed(2)} <span className="text-[10px] text-slate-500">mg/kg</span></p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#grad-${index})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col justify-center space-y-10">
                    <Gauge label="Nitrogen (N)" value={validateValue(data?.nitrogen)} color="text-emerald-400" icon={Wind} delay={0.1} />
                    <Gauge label="Phosphorus (P)" value={validateValue(data?.phosphorus)} color="text-blue-400" icon={Droplets} delay={0.2} />
                    <Gauge label="Potassium (K)" value={validateValue(data?.potassium)} color="text-amber-400" icon={Activity} delay={0.3} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SensorCard 
                  title="Ambient Temperature" 
                  value={weather.temp || validateValue(data?.temperature, true)} 
                  unit="°C" 
                  icon={Thermometer} 
                  color="text-rose-400"
                  trend={data && prevData ? calculateTrend(weather.temp || validateValue(data.temperature, true) || 0, validateValue(prevData.temperature, true) || 0) : undefined}
                  delay={0.4}
                />
                <SensorCard 
                  title="Soil Saturation" 
                  value={validateValue(data?.humidity, true)} 
                  unit="%" 
                  icon={Droplets} 
                  color="text-blue-400"
                  trend={data && prevData ? calculateTrend(validateValue(data.humidity, true) || 0, validateValue(prevData.humidity, true) || 0) : undefined}
                  delay={0.5}
                />
              </div>

              <div className="glass-card p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-50" />
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col gap-1">
                    <span className="serif-header">Environmental Monitoring</span>
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-amber-400 opacity-60" size={20} />
                      <h2 className="text-xl font-bold text-slate-100 uppercase tracking-widest">Tactical Weather Intelligence</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <MapPin size={14} className="text-slate-500" />
                    <span className="tech-label text-[9px]">
                      {location ? `${location.lat.toFixed(4)}°N, ${location.lng.toFixed(4)}°E` : 'ACQUIRING GPS...'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="tech-label text-slate-400">Field Directives</h3>
                    <div className="space-y-3">
                      {tacticalAdvice.map((advice, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          key={i} 
                          className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50"
                        >
                          <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${advice.includes('Optimal') ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          <p className="text-sm text-slate-300 leading-relaxed">{advice}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="tech-label text-slate-400">7-Day Outlook</h3>
                    <div className="space-y-2">
                      {forecast.slice(0, 5).map((day, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/30 border border-slate-900/50">
                          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                            {new Date(day.date).toLocaleDateString([], { weekday: 'short' })}
                          </span>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Droplets size={10} className="text-blue-500" />
                              <span className="text-[10px] font-mono text-slate-400">{day.precip.toFixed(1)}mm</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-200">{day.maxTemp.toFixed(0)}° / {day.minTemp.toFixed(0)}°</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <Sprout className="text-emerald-400" size={20} />
                    <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest">Growth Cycle</h2>
                  </div>
                  <span className="tech-label text-[10px] text-emerald-500">STAGE 3: VEGETATIVE</span>
                </div>
                <div className="relative pt-4 pb-8">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -translate-y-1/2" />
                  <div className="flex justify-between relative z-10">
                    {[
                      { label: 'Germination', active: true },
                      { label: 'Seedling', active: true },
                      { label: 'Vegetative', active: true, current: true },
                      { label: 'Flowering', active: false },
                      { label: 'Harvest', active: false }
                    ].map((stage, i) => (
                      <div key={i} className="flex flex-col items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 transition-all duration-500 ${
                          stage.current ? 'bg-emerald-500 border-white scale-125 glow-emerald' : 
                          stage.active ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-900 border-slate-700'
                        }`} />
                        <span className={`tech-label text-[8px] ${stage.active ? 'text-slate-200' : 'text-slate-600'}`}>{stage.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-6 flex flex-col items-center justify-center text-center gap-2">
                  <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
                    <Wind size={20} />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-100">{weather.temp}°C</div>
                  <span className="tech-label text-[8px] uppercase tracking-widest">{weather.condition}</span>
                </div>
                <div className="glass-card p-6 flex flex-col items-center justify-center text-center gap-2">
                  <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
                    <TrendingUp size={20} />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-100">84%</div>
                  <span className="tech-label text-[8px] uppercase tracking-widest">Yield Forecast</span>
                </div>
              </div>

              <div className="glass-card p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Target size={120} />
                </div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Target className="text-emerald-400" size={20} />
                    <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest">Health Score</h2>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative">
                    <svg className="w-48 h-48 transform -rotate-90">
                      <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                      <motion.circle 
                        cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" 
                        strokeDasharray={553}
                        initial={{ strokeDashoffset: 553 }}
                        animate={{ strokeDashoffset: 553 - (553 * calculateHealthScore(data!)) / 100 }}
                        className="text-emerald-500" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black font-mono text-slate-100">{calculateHealthScore(data!).toFixed(0)}</span>
                      <span className="tech-label text-[10px] opacity-50">OPTIMAL</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card p-8 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <MapPin className="text-emerald-400" size={20} />
                    <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest">Satellite View</h2>
                  </div>
                </div>
                <div className="flex-1 min-h-[300px] rounded-2xl overflow-hidden border border-slate-800/50 relative group">
                  <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/farm-satellite/800/600')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700" />
                  <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay" />
                </div>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'history' ? (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="glass-card p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <History className="text-blue-400" size={24} />
                  <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest">Historical Readings</h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="py-4 px-4 serif-header">Timestamp</th>
                      <th className="py-4 px-4 serif-header">Nitrogen</th>
                      <th className="py-4 px-4 serif-header">Phosphorus</th>
                      <th className="py-4 px-4 serif-header">Potassium</th>
                      <th className="py-4 px-4 serif-header">Temp</th>
                      <th className="py-4 px-4 serif-header">Humidity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length > 0 ? (
                      history.map((record, i) => (
                        <tr key={record.id || i} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                          <td className="py-4 px-4 font-mono text-xs text-slate-400">{record.time || 'N/A'}</td>
                          <td className="py-4 px-4 font-mono text-sm font-bold text-emerald-400">{record.nitrogen?.toFixed(1)}</td>
                          <td className="py-4 px-4 font-mono text-sm font-bold text-blue-400">{record.phosphorus?.toFixed(1)}</td>
                          <td className="py-4 px-4 font-mono text-sm font-bold text-amber-400">{record.potassium?.toFixed(1)}</td>
                          <td className="py-4 px-4 font-mono text-sm text-rose-400">{record.temperature?.toFixed(1)}°C</td>
                          <td className="py-4 px-4 font-mono text-sm text-blue-300">{record.humidity?.toFixed(1)}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-30">
                            <Database size={48} />
                            <p className="tech-label">No historical data found in telemetry logs.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'intelligence' ? (
          <motion.div 
            key="intelligence"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="glass-card p-10 relative">
              <div className="flex items-center justify-between mb-12">
                <div className="flex flex-col gap-1">
                  <span className="serif-header">Agronomic Intelligence Unit</span>
                  <div className="flex items-center gap-3">
                    <BrainCircuit className="text-emerald-400 opacity-60" size={20} />
                    <h2 className="text-xl font-bold text-slate-100 uppercase tracking-widest">Soil Analysis Report</h2>
                  </div>
                </div>
                <button 
                  onClick={runAiAnalysis}
                  disabled={analyzing}
                  className={`px-8 py-3 rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all ${analyzing ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'}`}
                >
                  {analyzing ? 'PROCESSING DATA...' : 'INITIATE ANALYSIS'}
                </button>
              </div>
              <div className="prose prose-invert max-w-none min-h-[400px] bg-slate-950/20 rounded-2xl p-10 border border-slate-800/30 shadow-inner">
                {aiAnalysis ? (
                  <div className="markdown-body">
                    <Markdown>{aiAnalysis}</Markdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 py-20">
                    <BrainCircuit size={48} className="opacity-20" />
                    <p className="tech-label text-center">Click "Run Analysis" to generate AI insights.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'assistant' ? (
          <motion.div 
            key="assistant"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col glass-card h-[600px] overflow-hidden"
          >
            <div className="flex-grow overflow-y-auto p-8 space-y-8">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] space-y-2 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="tech-label text-[8px] px-1">{msg.role === 'user' ? 'OPERATOR' : 'SOILGUARD AI'}</span>
                    <div className={`p-5 rounded-2xl shadow-xl ${msg.role === 'user' ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20' : 'bg-slate-900/80 text-slate-200 border border-slate-800/50'}`}>
                      <div className="markdown-body text-sm leading-relaxed">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="p-6 bg-slate-950/80 border-t border-white/5 flex gap-4 backdrop-blur-md">
              <input 
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Transmit query to SoilGuard AI..."
                className="flex-grow bg-slate-900/50 border border-white/5 rounded-xl px-6 py-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
              />
              <button 
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="px-8 py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-[10px] tracking-widest uppercase hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
              >
                {chatLoading ? 'SENDING...' : 'TRANSMIT'}
              </button>
            </form>
          </motion.div>
        ) : activeTab === 'control' ? (
          <motion.div 
            key="control"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <div className="glass-card p-10 flex flex-col justify-between min-h-[300px]">
              <div className="space-y-1">
                <span className="serif-header">Hydration Management</span>
                <h2 className="text-xl font-bold text-slate-100 uppercase tracking-widest">Irrigation Control</h2>
              </div>
              <div className="py-10 flex justify-center">
                <div className={`p-8 rounded-full border-2 ${irrigationActive ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'border-slate-800 bg-slate-900/50'} transition-all duration-500`}>
                  <Droplets size={48} className={irrigationActive ? 'text-blue-400 animate-bounce' : 'text-slate-700'} />
                </div>
              </div>
              <button 
                onClick={() => setIrrigationActive(!irrigationActive)}
                className={`w-full py-4 rounded-xl font-bold tracking-[0.2em] text-[10px] uppercase transition-all ${irrigationActive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20'}`}
              >
                {irrigationActive ? 'TERMINATE IRRIGATION' : 'INITIATE IRRIGATION'}
              </button>
            </div>
            <div className="glass-card p-10 flex flex-col justify-between min-h-[300px]">
              <div className="space-y-1">
                <span className="serif-header">Nutrient Injection</span>
                <h2 className="text-xl font-bold text-slate-100 uppercase tracking-widest">Dosing System</h2>
              </div>
              <div className="py-10 flex justify-center">
                <div className={`p-8 rounded-full border-2 ${fertilizerActive ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'border-slate-800 bg-slate-900/50'} transition-all duration-500`}>
                  <Zap size={48} className={fertilizerActive ? 'text-amber-400 animate-pulse' : 'text-slate-700'} />
                </div>
              </div>
              <button 
                onClick={() => setFertilizerActive(!fertilizerActive)}
                className={`w-full py-4 rounded-xl font-bold tracking-[0.2em] text-[10px] uppercase transition-all ${fertilizerActive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'}`}
              >
                {fertilizerActive ? 'TERMINATE DOSING' : 'INITIATE DOSING'}
              </button>
            </div>
          </motion.div>
        ) : activeTab === 'logbook' ? (
          <motion.div 
            key="logbook"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="glass-card p-10">
              <div className="flex flex-col gap-1 mb-8">
                <span className="serif-header">Field Observations</span>
                <h2 className="text-xl font-bold text-slate-100 uppercase tracking-widest">Tactical Logbook</h2>
              </div>
              <form onSubmit={handleAddLog} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['observation', 'action', 'alert'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLogType(type)}
                      className={`py-3 rounded-xl font-bold text-[10px] tracking-widest uppercase border transition-all ${logType === type ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <textarea 
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  placeholder="Enter tactical observation details..."
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 min-h-[150px] transition-all"
                />
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-[10px] tracking-widest uppercase hover:bg-emerald-500/20 transition-all"
                >
                  COMMIT TO LOGBOOK
                </button>
              </form>
            </div>
            
            <div className="space-y-4">
              {logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={log.id || i} 
                  className="glass-card p-6 flex items-start gap-6 group"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-px h-6 bg-slate-800" />
                    <div className={`p-3 rounded-xl ${log.type === 'alert' ? 'bg-rose-500/10 text-rose-500' : log.type === 'action' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {log.type === 'alert' ? <AlertTriangle size={18} /> : log.type === 'action' ? <Zap size={18} /> : <FileText size={18} />}
                    </div>
                    <div className="w-px h-full bg-slate-800" />
                  </div>
                  <div className="flex-grow py-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="tech-label text-[8px]">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '---'}</span>
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${log.type === 'alert' ? 'border-rose-500/30 text-rose-500' : 'border-slate-800 text-slate-500'}`}>
                        {log.type}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{log.content}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="glass-card p-8">
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest mb-8">Configuration</h2>
            <div className="space-y-6">
              <p className="text-sm text-slate-400">System settings and thresholds.</p>
              
              <div className="pt-6 border-t border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 mb-4 uppercase tracking-wider">Debug Tools</h3>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={generateSampleData}
                    className="px-6 py-2 bg-slate-800 text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-700 transition-all flex items-center gap-2"
                  >
                    <Plus size={14} />
                    GENERATE SAMPLE DATA
                  </button>
                  <button 
                    onClick={handleClearHistory}
                    className="px-6 py-2 bg-rose-900/20 text-rose-400 border border-rose-900/50 rounded-xl font-bold text-xs hover:bg-rose-900/40 transition-all flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    CLEAR ALL HISTORY
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
