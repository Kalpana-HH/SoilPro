import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Thermometer, 
  Droplets, 
  MapPin, 
  Map as MapIcon,
  Eye,
  Sun,
  Fan,
  FlaskConical,
  CloudRain,
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
  X,
  Lightbulb,
  Send
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
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="space-y-3 group/gauge"
  >
    <div className="flex justify-between items-end">
      <div className="flex flex-col">
        <span className="tech-label opacity-40 group-hover/gauge:opacity-60 transition-opacity">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="data-value text-xl group-hover/gauge:text-emerald-400 transition-colors">
          {value !== undefined ? value.toFixed(1) : '---'}
        </span>
        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">mg/kg</span>
      </div>
    </div>
    <div className="h-1 bg-white/5 rounded-full overflow-hidden relative">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value || 0, 100)}%` }}
        className={`h-full rounded-full relative z-10 ${color.replace('text-', 'bg-')} shadow-[0_0_10px_rgba(16,185,129,0.3)]`}
        transition={{ type: "spring", stiffness: 40, damping: 12, delay: delay + 0.2 }}
      />
    </div>
  </motion.div>
);

const SensorCard = ({ title, value, unit, icon: Icon, trend, color, delay = 0, className = "" }: any) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay }}
    className={`glass-card p-6 group relative flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-500 ${className}`}
  >
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <span className="tech-label opacity-40 group-hover:opacity-60 transition-opacity">{title}</span>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} animate-pulse`} />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Live</span>
        </div>
      </div>
      <div className={`p-2 rounded-xl bg-white/2 border border-white/5 group-hover:border-emerald-500/20 transition-all`}>
        <Icon size={16} className={`${color} opacity-40 group-hover:opacity-100 transition-all`} />
      </div>
    </div>
    
    <div className="space-y-2 mt-6">
      <div className="flex items-baseline gap-2">
        <h3 className="text-4xl font-bold data-value tracking-tighter group-hover:text-emerald-400 transition-colors">
          {value !== undefined && value !== null ? value.toFixed(1) : '---'}
        </h3>
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{unit}</span>
      </div>
      
      {trend !== undefined && (
        <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span>{Math.abs(trend ?? 0).toFixed(1)}% variance</span>
        </div>
      )}
    </div>
  </motion.div>
);

const ControlCard = ({ title, active, onToggle, icon: Icon, color, desc }: any) => {
  const colorMap: any = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]' },
  };

  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className="glass-card p-6 flex flex-col justify-between min-h-[280px] hover:border-emerald-500/20 transition-all group">
      <div className="space-y-1">
        <span className="tech-label opacity-40 group-hover:opacity-60 transition-opacity">{desc}</span>
        <h2 className="text-xs font-bold text-slate-100 uppercase tracking-widest">{title} Control</h2>
      </div>
      
      <div className="py-8 flex justify-center">
        <motion.div 
          animate={active ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className={`p-8 rounded-full border transition-all duration-500 ${
            active ? `${theme.border} ${theme.bg} ${theme.glow}` : 'border-white/5 bg-white/2 grayscale opacity-40'
          }`}
        >
          <Icon size={32} className={active ? theme.text : 'text-slate-600'} />
        </motion.div>
      </div>

      <button 
        onClick={onToggle}
        className={`w-full py-3.5 rounded-xl tech-label transition-all font-bold tracking-widest uppercase text-[10px] ${
          active 
            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' 
            : `${theme.bg} ${theme.text} border ${theme.border} hover:bg-white/5`
        }`}
      >
        {active ? 'Terminate System' : 'Initiate System'}
      </button>
    </div>
  );
};

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

  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'ai' | 'control'>('overview');
  const [selectedMetric, setSelectedMetric] = useState<'nitrogen' | 'phosphorus' | 'potassium' | 'temperature' | 'humidity'>('nitrogen');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: "AI Command Center online. I am monitoring all telemetry streams. How can I assist with field optimization?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState('Field Alpha');
  
  // Controls
  const [irrigationActive, setIrrigationActive] = useState(false);
  const [fertilizerActive, setFertilizerActive] = useState(false);
  const [ventilationActive, setVentilationActive] = useState(false);
  const [lightingActive, setLightingActive] = useState(false);
  const [phAdjusterActive, setPhAdjusterActive] = useState(false);
  const [co2ScrubberActive, setCo2ScrubberActive] = useState(false);
  
  const [thresholds, setThresholds] = useState({
    nitrogen: { min: 20, max: 80 },
    phosphorus: { min: 20, max: 80 },
    potassium: { min: 20, max: 80 },
    temp: { min: 15, max: 35 },
    humidity: { min: 30, max: 80 }
  });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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

  const handleClearHistory = async () => {
    if (!user) return;
    try {
      const path = 'readings';
      const q = query(collection(db, path), limit(450));
      const snapshot = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.LIST, path));
      
      if (!snapshot || snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, path));
    } catch (err: any) {
      console.error("Error clearing history:", err);
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

    return () => {
      unsubLatest();
      unsubHistory();
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

  const getMetricData = () => {
    return [...history].reverse().map(record => ({
      time: record.time || new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: record[selectedMetric] || 0
    }));
  };

  const metricConfig = {
    nitrogen: { label: 'Nitrogen', color: '#10b981', unit: 'mg/kg', icon: Wind },
    phosphorus: { label: 'Phosphorus', color: '#3b82f6', unit: 'mg/kg', icon: Droplets },
    potassium: { label: 'Potassium', color: '#f59e0b', unit: 'mg/kg', icon: Activity },
    temperature: { label: 'Temperature', color: '#f43f5e', unit: '°C', icon: Thermometer },
    humidity: { label: 'Humidity', color: '#0ea5e9', unit: '%', icon: CloudRain },
  };

  const calculateTrend = (current: number, previous: number) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-[#030712] text-slate-200 transition-colors duration-500 relative overflow-hidden">
        <div className="scanline" />
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        
        {/* Sidebar */}
        <motion.aside 
          initial={false}
          animate={{ 
            width: sidebarOpen ? 280 : 0,
            opacity: sidebarOpen ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex-shrink-0 border-r flex flex-col bg-slate-950/50 border-white/5 backdrop-blur-xl z-50 overflow-hidden relative"
        >
          <motion.div 
            animate={{ opacity: sidebarOpen ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="p-6 w-[280px] flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                >
                  <Sprout className="text-emerald-500" size={20} />
                </motion.div>
                <div>
                  <h1 className="text-lg font-black tracking-tighter leading-none mb-1 text-slate-100">SOILGUARD</h1>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="tech-label text-[7px] text-slate-500">Command Center</span>
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

            <nav className="space-y-1.5">
              {[
                { id: 'overview', label: 'Overview', icon: PulseIcon },
                { id: 'history', label: 'History', icon: History },
                { id: 'ai', label: 'AI Command', icon: BrainCircuit },
                { id: 'control', label: 'Control', icon: Zap },
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full sidebar-item ${
                    activeTab === tab.id ? 'sidebar-item-active' : 'sidebar-item-inactive'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="mt-auto space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900/30 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="tech-label text-[8px]">System Status</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Online</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="tech-label text-[8px]">Uptime</span>
                  <span className="text-[9px] font-mono text-slate-500">24d 12h 04m</span>
                </div>
              </div>

              {user ? (
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold text-slate-500 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
                >
                  <LogOut size={12} />
                  SIGN OUT
                </button>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                >
                  <LogIn size={12} />
                  SIGN IN
                </button>
              )}
            </div>
          </motion.div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-grow overflow-y-auto relative">
          <header className="sticky top-0 z-40 px-4 lg:px-10 py-3 lg:py-5 border-b border-white/5 backdrop-blur-md flex items-center justify-between bg-[#030712]/80">
            <div className="flex items-center gap-3 lg:gap-8">
              {!sidebarOpen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-xl border border-white/5 bg-slate-900 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
                >
                  <Menu size={18} />
                </motion.button>
              )}
              <div className="hidden md:flex flex-col gap-0.5">
                <span className="tech-label opacity-40">Sector</span>
                <span className="text-[10px] lg:text-sm font-bold text-slate-100 uppercase tracking-widest">Alpha-7</span>
              </div>
              <div className="hidden lg:block w-px h-8 bg-white/5" />
              <div className="hidden lg:flex flex-col gap-0.5">
                <span className="tech-label opacity-40">Source</span>
                <span className={`text-[10px] font-bold ${data?.source?.includes('Live') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data?.source || 'Simulated'}
                </span>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex flex-col gap-0.5">
                <span className="tech-label opacity-40">Sync</span>
                <span className="text-[10px] lg:text-xs font-bold text-blue-400">
                  {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '---'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 lg:gap-4">
              <div className="hidden xl:flex flex-col items-end mr-2">
                <span className="tech-label opacity-40">Environment</span>
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  {window.location.hostname.includes('ais-pre') ? 'PRODUCTION' : 'DEVELOPMENT'}
                </span>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={fetchFallbackData}
                className="p-2 lg:p-2.5 rounded-xl border border-white/5 bg-slate-900 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </motion.button>
            </div>
          </header>

          <div className="p-4 lg:p-8 max-w-[1600px] mx-auto h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' ? (
                <motion.div 
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-6 lg:p-10 bento-grid"
                >
                  {/* Main Telemetry Graph */}
                  <div className="xl:col-span-8 xl:row-span-4 glass-card p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="space-y-1">
                        <span className="tech-label opacity-40">Temporal Analysis</span>
                        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Field Telemetry</h2>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-white/5">
                        {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map((m) => (
                          <button
                            key={m}
                            onClick={() => setSelectedMetric(m)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                              selectedMetric === m 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {m.slice(0, 4)}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex-grow min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getMetricData()}>
                          <defs>
                            <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={metricConfig[selectedMetric].color} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={metricConfig[selectedMetric].color} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis 
                            dataKey="time" 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={8} 
                            tickLine={false} 
                            axisLine={false} 
                            dy={10}
                          />
                          <YAxis 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={8} 
                            tickLine={false} 
                            axisLine={false} 
                            dx={-10}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            itemStyle={{ color: '#f8fafc', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                            labelStyle={{ color: '#64748b', fontSize: '8px', marginBottom: '4px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={metricConfig[selectedMetric].color} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorMetric)" 
                            animationDuration={1000}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Macro Nutrients - Side Bento Box */}
                  <div className="xl:col-span-4 xl:row-span-3 glass-card p-6 flex flex-col justify-between">
                    <div className="space-y-1 mb-6">
                      <span className="tech-label opacity-40">Soil Chemistry</span>
                      <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Macro Nutrients</h2>
                    </div>
                    <div className="space-y-6">
                      <Gauge label="Nitrogen (N)" value={validateValue(data?.nitrogen)} color="text-emerald-400" icon={Wind} delay={0.1} />
                      <Gauge label="Phosphorus (P)" value={validateValue(data?.phosphorus)} color="text-blue-400" icon={Droplets} delay={0.2} />
                      <Gauge label="Potassium (K)" value={validateValue(data?.potassium)} color="text-amber-400" icon={Activity} delay={0.3} />
                    </div>
                  </div>

                  {/* Weather Intelligence - Wide Bento Box */}
                  <div className="xl:col-span-8 xl:row-span-2 glass-card p-6 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-1">
                        <span className="tech-label opacity-40">Environmental Intel</span>
                        <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Tactical Weather</h2>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 rounded-xl border border-white/5">
                        <MapPin size={10} className="text-emerald-500" />
                        <span className="tech-label text-[7px] text-slate-300">
                          {location ? `${location.lat.toFixed(2)}°N, ${location.lng.toFixed(2)}°E` : 'GPS LOCATING...'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <span className="tech-label opacity-30">Directives</span>
                        <div className="space-y-2">
                          {tacticalAdvice.slice(0, 2).map((advice, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/2 border border-white/5 hover:border-emerald-500/20 transition-all">
                              <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${advice.includes('Optimal') ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                              <p className="text-[10px] text-slate-400 leading-relaxed">{advice}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="tech-label opacity-30">Outlook</span>
                        <div className="grid grid-cols-5 gap-2">
                          {forecast.slice(0, 5).map((day, i) => (
                            <div key={i} className="flex flex-col items-center p-2 rounded-xl bg-white/2 border border-white/5 hover:bg-emerald-500/5 transition-all">
                              <span className="text-[7px] font-bold text-slate-500 uppercase mb-1">
                                {new Date(day.date).toLocaleDateString([], { weekday: 'short' })}
                              </span>
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-bold text-slate-200">{day.maxTemp.toFixed(0)}°</span>
                                <CloudRain size={8} className="text-blue-500/50" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Environment Stats */}
                  <SensorCard 
                    className="xl:col-span-2 xl:row-span-2"
                    title="Ambient Temp" 
                    value={weather.temp || validateValue(data?.temperature, true)} 
                    unit="°C" 
                    icon={Thermometer} 
                    color="text-rose-400"
                    trend={data && prevData ? calculateTrend(weather.temp || validateValue(data.temperature, true) || 0, validateValue(prevData.temperature, true) || 0) : undefined}
                    delay={0.4}
                  />
                  <SensorCard 
                    className="xl:col-span-2 xl:row-span-2"
                    title="Soil Saturation" 
                    value={validateValue(data?.humidity, true)} 
                    unit="%" 
                    icon={Droplets} 
                    color="text-blue-400"
                    trend={data && prevData ? calculateTrend(validateValue(data.humidity, true) || 0, validateValue(prevData.humidity, true) || 0) : undefined}
                    delay={0.5}
                  />

                  {/* Satellite View */}
                  <div className="xl:col-span-4 xl:row-span-3 glass-card p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-1">
                        <span className="tech-label opacity-40">Spatial Mapping</span>
                        <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Satellite View</h2>
                      </div>
                      <MapIcon size={12} className="text-slate-500" />
                    </div>
                    <div className="flex-grow rounded-xl overflow-hidden border border-white/5 relative group cursor-crosshair">
                      <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/farm-satellite/800/600')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-1000 scale-110 group-hover:scale-100" />
                      <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className="absolute top-1/2 left-0 w-full h-px bg-emerald-500/30" />
                        <div className="absolute top-0 left-1/2 w-px h-full bg-emerald-500/30" />
                      </div>
                      <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[7px] text-white/80 font-mono border border-white/10">
                        ALPHA-7 SECTOR
                      </div>
                    </div>
                  </div>

                  {/* Growth Cycle */}
                  <div className="xl:col-span-4 xl:row-span-1 glass-card p-5 flex items-center justify-between hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Sprout className="text-emerald-500" size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="tech-label opacity-40">Growth Cycle</span>
                        <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Vegetative Stage</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-bold text-emerald-500">Day 42</span>
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '66%' }}
                          className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
        ) : activeTab === 'history' ? (
          <motion.div 
            key="history"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-0.5">
                <span className="tech-label opacity-40">Temporal Data</span>
                <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Telemetry History</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                <Database size={12} className="text-slate-500" />
                <span className="tech-label text-[8px]">{history.length} Records</span>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-3 px-4 tech-label opacity-40">Timestamp</th>
                    <th className="py-3 px-4 tech-label opacity-40">N</th>
                    <th className="py-3 px-4 tech-label opacity-40">P</th>
                    <th className="py-3 px-4 tech-label opacity-40">K</th>
                    <th className="py-3 px-4 tech-label opacity-40">Temp</th>
                    <th className="py-3 px-4 tech-label opacity-40">Humid</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-mono">
                  {history.length > 0 ? (
                    history.map((record, i) => (
                      <tr key={record.id || i} className="border-b border-white/2 hover:bg-white/2 transition-colors">
                        <td className="py-3 px-4 text-slate-500">{record.time || '---'}</td>
                        <td className="py-3 px-4 text-emerald-400/60">{record.nitrogen?.toFixed(1)}</td>
                        <td className="py-3 px-4 text-blue-400/60">{record.phosphorus?.toFixed(1)}</td>
                        <td className="py-3 px-4 text-amber-400/60">{record.potassium?.toFixed(1)}</td>
                        <td className="py-3 px-4 text-rose-400/60">{record.temperature?.toFixed(1)}°</td>
                        <td className="py-3 px-4 text-blue-300/60">{record.humidity?.toFixed(1)}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center tech-label opacity-20 italic">No historical data available in current sector</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : activeTab === 'ai' ? (
          <motion.div 
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 lg:p-10"
          >
            {/* AI Analysis Section */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="glass-card p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1">
                    <span className="tech-label opacity-40">Neural Analysis</span>
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Tactical Intelligence</h2>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={runAiAnalysis}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 tech-label hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <Cpu size={14} className={analyzing ? 'animate-spin' : ''} />
                    {analyzing ? 'Processing...' : 'Run Analysis'}
                  </motion.button>
                </div>

                <div className="flex-grow bg-slate-950/30 rounded-xl border border-white/5 p-6 overflow-y-auto custom-scrollbar min-h-[300px]">
                  {aiAnalysis ? (
                    <div className="markdown-body text-[11px] leading-relaxed">
                      <Markdown>{aiAnalysis}</Markdown>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                      <BrainCircuit size={48} />
                      <p className="tech-label max-w-xs">Initialize neural analysis to generate tactical soil insights and growth projections</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Chat Section */}
            <div className="lg:col-span-5 flex flex-col glass-card h-[600px] overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-white/2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="tech-label opacity-40 uppercase tracking-widest">Direct Uplink</span>
                </div>
              </div>
              <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950/20">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] space-y-1 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="tech-label opacity-30 px-1 text-[8px]">{msg.role === 'user' ? 'OPERATOR' : 'SOILGUARD AI'}</span>
                      <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20 rounded-tr-none' : 'bg-white/5 text-slate-200 border border-white/5 rounded-tl-none'}`}>
                        <div className="markdown-body text-[10px] leading-relaxed">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 animate-pulse rounded-tl-none">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-75" />
                        <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-150" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSendMessage} className="p-4 bg-black/40 border-t border-white/5 flex gap-2">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Transmit query..."
                  className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/30 transition-all placeholder:text-slate-600"
                />
                <button 
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        ) : activeTab === 'control' ? (
          <motion.div 
            key="control"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 lg:p-10"
          >
            <ControlCard 
              title="Irrigation" 
              active={irrigationActive} 
              onToggle={() => setIrrigationActive(!irrigationActive)} 
              icon={Droplets} 
              color="blue"
              desc="Hydration Management"
            />
            <ControlCard 
              title="Fertilizer" 
              active={fertilizerActive} 
              onToggle={() => setFertilizerActive(!fertilizerActive)} 
              icon={Activity} 
              color="emerald"
              desc="Nutrient Injection"
            />
            <ControlCard 
              title="Ventilation" 
              active={ventilationActive} 
              onToggle={() => setVentilationActive(!ventilationActive)} 
              icon={Fan} 
              color="cyan"
              desc="Air Exchange System"
            />
            <ControlCard 
              title="Lighting" 
              active={lightingActive} 
              onToggle={() => setLightingActive(!lightingActive)} 
              icon={Lightbulb} 
              color="amber"
              desc="Photosynthetic Array"
            />
            <ControlCard 
              title="pH Adjuster" 
              active={phAdjusterActive} 
              onToggle={() => setPhAdjusterActive(!phAdjusterActive)} 
              icon={FlaskConical} 
              color="purple"
              desc="Acidity Regulation"
            />
            <ControlCard 
              title="CO2 Scrubber" 
              active={co2ScrubberActive} 
              onToggle={() => setCo2ScrubberActive(!co2ScrubberActive)} 
              icon={Wind} 
              color="rose"
              desc="Atmospheric Purifier"
            />
          </motion.div>
        ) : (
          <div className="glass-card p-8 m-6 lg:m-10">
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest mb-8">System Configuration</h2>
            <div className="space-y-6">
              <p className="text-sm text-slate-400">Advanced telemetry settings and debug utilities.</p>
              
              <div className="pt-6 border-t border-white/5">
                <h3 className="text-xs font-bold text-slate-200 mb-4 uppercase tracking-wider">Debug Protocol</h3>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={generateSampleData}
                    className="px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-[10px] hover:bg-emerald-500/20 transition-all flex items-center gap-2 uppercase tracking-widest"
                  >
                    <Plus size={14} />
                    Generate Telemetry
                  </button>
                  <button 
                    onClick={handleClearHistory}
                    className="px-6 py-3 bg-rose-900/10 text-rose-400 border border-rose-900/50 rounded-xl font-bold text-[10px] hover:bg-rose-900/20 transition-all flex items-center gap-2 uppercase tracking-widest"
                  >
                    <Trash2 size={14} />
                    Purge History
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
