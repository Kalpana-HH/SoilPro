import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Thermometer, 
  Droplets, 
  MapPin, 
  Map as MapIcon,
  Eye,
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
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="space-y-2"
  >
    <div className="flex justify-between items-end">
      <div className="flex flex-col">
        <span className="tech-label opacity-40">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="data-value text-lg">
          {value !== undefined ? value.toFixed(1) : '---'}
        </span>
        <span className="text-[7px] text-slate-600 font-bold uppercase tracking-widest">mg/kg</span>
      </div>
    </div>
    <div className="h-0.5 bg-white/5 rounded-full overflow-hidden relative">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value || 0, 100)}%` }}
        className={`h-full rounded-full relative z-10 ${color.replace('text-', 'bg-')}`}
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
    className={`glass-card p-5 group relative flex flex-col justify-between ${className}`}
  >
    <div className="flex justify-between items-start">
      <div className="space-y-0.5">
        <span className="tech-label opacity-40">{title}</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-1 h-1 rounded-full ${color.replace('text-', 'bg-')} opacity-40`} />
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Active</span>
        </div>
      </div>
      <Icon size={14} className={`${color} opacity-20 group-hover:opacity-40 transition-opacity`} />
    </div>
    
    <div className="space-y-1">
      <div className="flex items-baseline gap-1.5">
        <h3 className="text-3xl font-bold data-value tracking-tighter">
          {value !== undefined && value !== null ? value.toFixed(1) : '---'}
        </h3>
        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">{unit}</span>
      </div>
      
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-[8px] font-bold uppercase tracking-tighter ${trend >= 0 ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
          {trend >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
          <span>{Math.abs(trend ?? 0).toFixed(1)}% variance</span>
        </div>
      )}
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
          <header className={`sticky top-0 z-40 px-4 lg:px-10 py-4 lg:py-6 border-b backdrop-blur-md flex items-center justify-between ${nightVision ? 'bg-black/80 border-rose-900/30' : 'bg-[#020617]/80 border-slate-800/50'}`}>
            <div className="flex items-center gap-4 lg:gap-8">
              {!sidebarOpen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSidebarOpen(true)}
                  className={`p-2 rounded-xl border transition-all ${nightVision ? 'bg-rose-950/20 border-rose-900/50 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50'}`}
                >
                  <Menu size={18} />
                </motion.button>
              )}
              <div className="hidden sm:flex flex-col gap-0.5">
                <span className="tech-label opacity-40">Sector</span>
                <span className="text-[10px] lg:text-sm font-bold text-slate-100 uppercase tracking-widest">Alpha-7</span>
              </div>
              <div className="hidden md:block w-px h-8 bg-slate-800/50" />
              <div className="hidden md:flex flex-col gap-0.5">
                <span className="tech-label opacity-40">Source</span>
                <span className={`text-[10px] font-bold ${data?.source?.includes('Live') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data?.source || 'Simulated'}
                </span>
              </div>
              <div className="w-px h-8 bg-slate-800/50" />
              <div className="flex flex-col gap-0.5">
                <span className="tech-label opacity-40">Sync</span>
                <span className="text-[10px] lg:text-xs font-bold text-blue-400">
                  {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '---'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 lg:gap-4">
              <div className="hidden lg:flex flex-col items-end mr-2">
                <span className="tech-label opacity-40">Environment</span>
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  {window.location.hostname.includes('ais-pre') ? 'PRODUCTION' : 'DEVELOPMENT'}
                </span>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={fetchFallbackData}
                className={`p-2 lg:p-2.5 rounded-xl border transition-all ${nightVision ? 'bg-rose-950/20 border-rose-900/50 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50'}`}
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
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  className="bento-grid"
                >
            {/* Main Chart - Large Bento Box */}
            <div className="xl:col-span-8 xl:row-span-3 glass-card p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-0.5">
                  <span className="tech-label opacity-40">Soil Composition Analysis</span>
                  <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Nutrient Profile</h2>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="tech-label text-[7px]">Live Stream</span>
                </div>
              </div>
              
              <div className="flex-grow min-h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      {chartData.map((entry, index) => (
                        <linearGradient key={`grad-${index}`} id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={0.4}/>
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.05}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} opacity={0.05} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#475569" 
                      fontSize={7} 
                      tickLine={false} 
                      axisLine={false}
                      dy={5}
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={7} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="glass-card p-2 border-white/10 shadow-2xl">
                              <p className="tech-label opacity-40 mb-0.5">{data.full}</p>
                              <p className="text-sm font-mono font-bold text-slate-100">{(data.value ?? 0).toFixed(2)} <span className="text-[7px] text-slate-500">mg/kg</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={30}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#grad-${index})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Nutrient Gauges - Side Bento Box */}
            <div className="xl:col-span-4 xl:row-span-3 glass-card p-5 flex flex-col justify-between">
              <div className="space-y-0.5 mb-4">
                <span className="tech-label opacity-40">Real-time Telemetry</span>
                <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Macro Nutrients</h2>
              </div>
              <div className="space-y-4">
                <Gauge label="Nitrogen (N)" value={validateValue(data?.nitrogen)} color="text-emerald-400" icon={Wind} delay={0.1} />
                <Gauge label="Phosphorus (P)" value={validateValue(data?.phosphorus)} color="text-blue-400" icon={Droplets} delay={0.2} />
                <Gauge label="Potassium (K)" value={validateValue(data?.potassium)} color="text-amber-400" icon={Activity} delay={0.3} />
              </div>
            </div>

            {/* Weather Intelligence - Wide Bento Box */}
            <div className="xl:col-span-8 xl:row-span-3 glass-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-0.5">
                  <span className="tech-label opacity-40">Environmental Monitoring</span>
                  <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Tactical Weather</h2>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                  <MapPin size={10} className="text-slate-500" />
                  <span className="tech-label text-[7px]">
                    {location ? `${location.lat.toFixed(2)}°N, ${location.lng.toFixed(2)}°E` : 'GPS...'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="tech-label opacity-30">Field Directives</span>
                  <div className="space-y-1.5">
                    {tacticalAdvice.slice(0, 3).map((advice, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/2 border border-white/5">
                        <div className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${advice.includes('Optimal') ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        <p className="text-[10px] text-slate-400 leading-tight">{advice}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="tech-label opacity-30">7-Day Outlook</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {forecast.slice(0, 5).map((day, i) => (
                      <div key={i} className="flex flex-col items-center p-1.5 rounded-lg bg-white/2 border border-white/5">
                        <span className="text-[6px] font-bold text-slate-500 uppercase mb-0.5">
                          {new Date(day.date).toLocaleDateString([], { weekday: 'short' })}
                        </span>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold text-slate-200">{day.maxTemp.toFixed(0)}°</span>
                          <Droplets size={6} className="text-blue-500/50" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Environment Stats - Small Bento Boxes */}
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

            {/* Growth Cycle - Long Bento Box */}
            <div className="xl:col-span-4 xl:row-span-1 glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <Sprout className="text-emerald-500" size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="tech-label opacity-40">Growth Cycle</span>
                  <span className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">Vegetative Stage</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-emerald-500/60">Day 42</span>
                <div className="w-10 h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="w-2/3 h-full bg-emerald-500" />
                </div>
              </div>
            </div>

            {/* Satellite View - Large Bento Box */}
            <div className="xl:col-span-4 xl:row-span-3 glass-card p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-0.5">
                  <span className="tech-label opacity-40">Spatial Mapping</span>
                  <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Satellite View</h2>
                </div>
                <MapIcon size={12} className="text-slate-500" />
              </div>
              <div className="flex-grow rounded-lg overflow-hidden border border-white/5 relative group">
                <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/farm-satellite/800/600')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700" />
                <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay" />
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[6px] text-white/60 font-mono">
                  ALPHA-7 SECTOR
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
        ) : activeTab === 'intelligence' ? (
          <motion.div 
            key="intelligence"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className="lg:col-span-8 glass-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                  <span className="tech-label opacity-40">Neural Analysis</span>
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">AI Soil Intelligence</h2>
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

              <div className="flex-grow bg-black/20 rounded-xl border border-white/5 p-6 overflow-y-auto custom-scrollbar min-h-[400px]">
                {aiAnalysis ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="markdown-body">
                      <Markdown>{aiAnalysis}</Markdown>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                    <BrainCircuit size={48} />
                    <p className="tech-label max-w-xs">Initialize neural analysis to generate tactical soil insights and growth projections</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="glass-card p-6">
                <h3 className="tech-label opacity-40 mb-4">Analysis Parameters</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Model', value: 'Gemini 2.0 Flash' },
                    { label: 'Context', value: 'Hyper-Local Weather' },
                    { label: 'Data Points', value: '128-bit Telemetry' },
                    { label: 'Confidence', value: '98.4%' }
                  ].map((param, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">{param.label}</span>
                      <span className="text-[10px] font-mono text-slate-300">{param.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="glass-card p-6 bg-emerald-500/5 border-emerald-500/10">
                <div className="flex items-center gap-3 mb-4">
                  <Zap size={16} className="text-emerald-400" />
                  <h3 className="tech-label text-emerald-400">Tactical Recommendation</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  "Current Nitrogen levels are slightly below optimal for the vegetative stage. Consider a 15% increase in nutrient dosing over the next 48 hours."
                </p>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'assistant' ? (
          <motion.div 
            key="assistant"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex flex-col glass-card h-[600px] overflow-hidden"
          >
            <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] space-y-1 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="tech-label opacity-30 px-1">{msg.role === 'user' ? 'OPERATOR' : 'SOILGUARD AI'}</span>
                    <div className={`p-4 rounded-xl ${msg.role === 'user' ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20' : 'bg-white/5 text-slate-200 border border-white/5'}`}>
                      <div className="markdown-body text-[11px] leading-relaxed">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 animate-pulse">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-75" />
                      <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-150" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="p-4 bg-black/20 border-t border-white/5 flex gap-3">
              <input 
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Transmit query..."
                className="flex-grow bg-white/5 border border-white/5 rounded-lg px-4 py-3 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/30 transition-all placeholder:text-slate-600"
              />
              <button 
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg tech-label hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
              >
                Send
              </button>
            </form>
          </motion.div>
        ) : activeTab === 'control' ? (
          <motion.div 
            key="control"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="glass-card p-6 flex flex-col justify-between min-h-[250px]">
              <div className="space-y-0.5">
                <span className="tech-label opacity-40">Hydration Management</span>
                <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Irrigation Control</h2>
              </div>
              <div className="py-6 flex justify-center">
                <div className={`p-6 rounded-full border ${irrigationActive ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'border-white/5 bg-white/2'} transition-all duration-500`}>
                  <Droplets size={32} className={irrigationActive ? 'text-blue-400 animate-pulse' : 'text-slate-700'} />
                </div>
              </div>
              <button 
                onClick={() => setIrrigationActive(!irrigationActive)}
                className={`w-full py-3 rounded-lg tech-label transition-all ${irrigationActive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'}`}
              >
                {irrigationActive ? 'Terminate' : 'Initiate'}
              </button>
            </div>
            <div className="glass-card p-6 flex flex-col justify-between min-h-[250px]">
              <div className="space-y-0.5">
                <span className="tech-label opacity-40">Nutrient Injection</span>
                <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Dosing System</h2>
              </div>
              <div className="py-6 flex justify-center">
                <div className={`p-6 rounded-full border ${fertilizerActive ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'border-white/5 bg-white/2'} transition-all duration-500`}>
                  <Zap size={32} className={fertilizerActive ? 'text-amber-400 animate-pulse' : 'text-slate-700'} />
                </div>
              </div>
              <button 
                onClick={() => setFertilizerActive(!fertilizerActive)}
                className={`w-full py-3 rounded-lg tech-label transition-all ${fertilizerActive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'}`}
              >
                {fertilizerActive ? 'Terminate' : 'Initiate'}
              </button>
            </div>
          </motion.div>
        ) : activeTab === 'logbook' ? (
          <motion.div 
            key="logbook"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="glass-card p-6">
              <div className="space-y-0.5 mb-6">
                <span className="tech-label opacity-40">Field Observations</span>
                <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest">Tactical Logbook</h2>
              </div>
              <form onSubmit={handleAddLog} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {(['observation', 'action', 'alert'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLogType(type)}
                      className={`py-2 rounded-lg tech-label border transition-all ${logType === type ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/2 border-white/5 text-slate-500 hover:border-white/10'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <textarea 
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  placeholder="Enter observation details..."
                  className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/30 min-h-[100px] transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newLog.trim()}
                  className="w-full py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg tech-label hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
                >
                  Commit Entry
                </button>
              </form>
            </div>

            <div className="space-y-3">
              {logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={log.id || i} 
                  className="glass-card p-4 flex items-start gap-4"
                >
                  <div className={`mt-1 p-1.5 rounded-lg border ${
                    log.type === 'alert' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    log.type === 'action' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                    'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {log.type === 'alert' ? <AlertTriangle size={12} /> : log.type === 'action' ? <Zap size={12} /> : <FileText size={12} />}
                  </div>
                  <div className="flex-grow space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{log.type}</span>
                      <span className="text-[8px] font-mono text-slate-600">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '---'}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{log.content}</p>
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
