export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export type ActivePage = "home" | "report" | "alerts" | "insights";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  assigned_zone: string;
  phone?: string;
  token?: string;
}

export interface ZoneWaterSnapshot {
  ph: number;
  turbidity: number;
  temperature: number;
  tds: number;
  electrical_conductivity: number;
  dissolved_oxygen: number;
  is_anomaly: boolean;
  anomaly_score: number;
}

export interface CommunityZone {
  id: number;
  code: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  population: number;
  water_source_type: string;
  sanitation_index: number;
  current_risk_level: RiskLevel;
  current_risk_score: number;
  symptom_cases_active: number;
  last_updated: string;
  latest_water: ZoneWaterSnapshot | null;
}

export interface WaterReading {
  id: number;
  zone_id: number;
  zone_name: string;
  ph: number;
  turbidity: number;
  temperature: number;
  tds: number;
  electrical_conductivity: number;
  dissolved_oxygen: number;
  rainfall_mm: number;
  is_anomaly: boolean;
  anomaly_score: number;
  risk_level: RiskLevel;
  risk_score: number;
  source: string;
  recorded_by: string;
  timestamp: string;
}

export interface HealthReport {
  id: number;
  zone_id: number;
  zone_name: string;
  reporter_name: string;
  reporter_role: string;
  symptoms: string[];
  affected_count: number;
  severity: "Mild" | "Moderate" | "Severe";
  water_source_used: string;
  notes?: string;
  verified: boolean;
  timestamp: string;
}

export interface AlertItem {
  id: number;
  zone_id: number;
  zone_name: string;
  severity: RiskLevel;
  title: string;
  message: string;
  trigger_source: string;
  risk_score: number;
  status: "Pending" | "Verified" | "Dispatched" | "Resolved";
  verified_by?: string | null;
  action_taken?: string | null;
  timestamp: string;
  resolved_at?: string | null;
}

export interface ForecastPoint {
  day: string;
  date: string;
  predicted_score: number;
  risk_level: RiskLevel;
  mitigated_score: number;
}

export interface ExplanationItem {
  parameter: string;
  value: string;
  threshold: string;
  status: "Optimal" | "Warning" | "Critical";
  impact_weight: number;
  reason: string;
}

export interface MLMetrics {
  dataset?: {
    total_records: number;
    training_records: number;
    testing_records: number;
    sources: string[];
  };
  random_forest: {
    name: string;
    task: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    n_estimators: number;
    training_samples: number;
  };
  isolation_forest: {
    name: string;
    task: string;
    contamination_rate: number;
    n_estimators: number;
    detection_sensitivity: number;
  };
  xgboost: {
    name: string;
    task: string;
    n_estimators: number;
    learning_rate: number;
    r2_score: number;
    mae: number;
  };
  feature_importances: Record<string, number>;
}

export interface PredictionResponse {
  id?: number;
  zone_name: string;
  inputs: {
    ph: number;
    turbidity: number;
    temperature: number;
    tds: number;
    dissolved_oxygen: number;
    symptom_cases_7d: number;
    rainfall_mm: number;
  };
  predicted_risk_level: RiskLevel;
  risk_score: number;
  rf_probabilities: Record<RiskLevel, number>;
  is_anomaly: boolean;
  anomaly_score: number;
  forecast_7d: ForecastPoint[];
  explanations: ExplanationItem[];
  likely_pathogens: string[];
  recommended_actions: string[];
  model_metadata?: MLMetrics;
}

export interface DashboardSummary {
  kpis: {
    total_health_reports: number;
    total_affected_people: number;
    monitored_zones: number;
    high_or_critical_zones: number;
    active_alerts: number;
    pending_verification: number;
    anomalies_detected: number;
    water_quality_index: number;
    avg_ph: number;
    avg_turbidity: number;
    avg_tds: number;
    avg_do: number;
  };
  risk_distribution: Record<RiskLevel, number>;
  symptom_breakdown: Record<string, number>;
  zones: CommunityZone[];
  recent_alerts: AlertItem[];
  recent_readings: WaterReading[];
  recent_reports: HealthReport[];
  ml_metrics: MLMetrics;
}

export interface AnalyticsData {
  daily_trends: {
    date: string;
    avg_ph: number;
    avg_turbidity: number;
    avg_tds: number;
    avg_risk_score: number;
    anomalies: number;
  }[];
  monthly_trends: {
    month: string;
    water_quality_index: number;
    reported_cases: number;
    outbreak_alerts: number;
    avg_turbidity: number;
  }[];
  zone_comparison: {
    code: string;
    name: string;
    district: string;
    population: number;
    water_source: string;
    sanitation_index: number;
    risk_level: RiskLevel;
    risk_score: number;
    ph: number;
    turbidity: number;
    tds: number;
    dissolved_oxygen: number;
    total_symptom_cases: number;
  }[];
  ml_metrics: MLMetrics;
}

/**
 * Restrained, high-contrast typographic status styles.
 * Avoids decorative colored borders or pill backgrounds.
 */
export const RISK_BADGE_STYLES: Record<
  RiskLevel,
  { bg: string; text: string; border: string; dot: string; hex: string }
> = {
  Low: {
    bg: "bg-transparent",
    text: "text-zinc-400",
    border: "border-[#27272A]",
    dot: "bg-zinc-500",
    hex: "#71717A",
  },
  Moderate: {
    bg: "bg-transparent",
    text: "text-zinc-200",
    border: "border-[#3F3F46]",
    dot: "bg-zinc-300",
    hex: "#D4D4D8",
  },
  High: {
    bg: "bg-transparent",
    text: "text-amber-400",
    border: "border-[#3F3F46]",
    dot: "bg-amber-400",
    hex: "#F59E0B",
  },
  Critical: {
    bg: "bg-transparent",
    text: "text-red-400",
    border: "border-[#3F3F46]",
    dot: "bg-red-500",
    hex: "#EF4444",
  },
};
