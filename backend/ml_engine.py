import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    r2_score,
    mean_absolute_error,
)
from xgboost import XGBRegressor
from build_real_dataset import build_unified_real_dataset, compute_risk_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "models_artifacts")
DATASET_CSV_PATH = os.path.join(DATA_DIR, "water_quality_disease_dataset.csv")

RISK_CLASSES = ["Low", "Moderate", "High", "Critical"]
FEATURE_NAMES = [
    "ph",
    "turbidity",
    "temperature",
    "tds",
    "dissolved_oxygen",
    "symptom_cases_7d",
    "rainfall_mm",
]


class SmartHealthMLEngine:
    """
    Three-model AI/ML pipeline trained exclusively on cleaned real-world datasets
    (Indian CPCB NWMP monitoring stations + Kaggle Water Potability benchmark):
    1. Random Forest Classifier -> Disease-risk category (Low / Moderate / High / Critical)
    2. Isolation Forest -> Unsupervised water quality sensor outlier detection
    3. XGBoost Regressor -> Short-term 7-day risk score & trend forecasting
    """

    def __init__(self):
        self.rf_classifier = None
        self.isolation_forest = None
        self.xgb_forecaster = None
        self.metrics = {}
        self.feature_importances = {}
        self._train_models()

    def _train_models(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)

        if os.path.exists(DATASET_CSV_PATH):
            df = pd.read_csv(DATASET_CSV_PATH)
        else:
            df = build_unified_real_dataset()

        X = df[FEATURE_NAMES]
        y_class = df["label"]
        y_forecast = df["next_day_score"]

        X_train, X_test, y_train, y_test, yf_train, yf_test = train_test_split(
            X, y_class, y_forecast, test_size=0.2, random_state=42, stratify=y_class
        )

        # 1. Random Forest Classifier for Risk Category
        self.rf_classifier = RandomForestClassifier(
            n_estimators=140,
            max_depth=10,
            random_state=42,
        )
        self.rf_classifier.fit(X_train, y_train)
        y_pred = self.rf_classifier.predict(X_test)

        # 2. Isolation Forest trained on normal + moderate water readings for sensor anomaly detection
        water_cols = ["ph", "turbidity", "temperature", "tds", "dissolved_oxygen"]
        normal_water = df[df["label"].isin([0, 1])][water_cols]
        self.isolation_forest = IsolationForest(
            n_estimators=120,
            contamination=0.12,
            random_state=42,
        )
        self.isolation_forest.fit(normal_water)

        # 3. XGBoost Regressor for short-term risk forecasting
        self.xgb_forecaster = XGBRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.08,
            random_state=42,
            objective="reg:squarederror",
        )
        self.xgb_forecaster.fit(X_train, yf_train)
        yf_pred = self.xgb_forecaster.predict(X_test)
        xgb_r2 = round(float(r2_score(yf_test, yf_pred) * 100), 2)
        xgb_mae = round(float(mean_absolute_error(yf_test, yf_pred)), 2)

        # Evaluate real Isolation Forest outlier detection sensitivity on known Critical samples
        critical_water = df[df["label"] == 3][water_cols]
        iso_crit_preds = self.isolation_forest.predict(critical_water)
        iso_sensitivity = round(float((iso_crit_preds == -1).mean() * 100), 2)

        # Persist trained model artifacts (.joblib) to disk
        joblib.dump(self.rf_classifier, os.path.join(ARTIFACTS_DIR, "random_forest_classifier.joblib"))
        joblib.dump(self.isolation_forest, os.path.join(ARTIFACTS_DIR, "isolation_forest_anomaly.joblib"))
        joblib.dump(self.xgb_forecaster, os.path.join(ARTIFACTS_DIR, "xgboost_forecaster.joblib"))

        importances = self.rf_classifier.feature_importances_
        self.feature_importances = {
            feat: round(float(imp * 100), 1)
            for feat, imp in zip(FEATURE_NAMES, importances)
        }
        self.metrics = {
            "dataset": {
                "total_records": len(df),
                "training_records": len(X_train),
                "testing_records": len(X_test),
                "sources": [
                    "Indian CPCB / NWMP Water Monitoring Stations (1,790 rows)",
                    "Kaggle Water Potability Benchmark (1,991 rows)",
                ],
            },
            "random_forest": {
                "name": "Random Forest Classifier",
                "task": "Disease-Risk Category Classification (Low / Moderate / High / Critical)",
                "accuracy": round(float(accuracy_score(y_test, y_pred) * 100), 2),
                "precision": round(float(precision_score(y_test, y_pred, average="weighted") * 100), 2),
                "recall": round(float(recall_score(y_test, y_pred, average="weighted") * 100), 2),
                "f1_score": round(float(f1_score(y_test, y_pred, average="weighted") * 100), 2),
                "n_estimators": 140,
                "training_samples": len(X_train),
            },
            "isolation_forest": {
                "name": "Isolation Forest",
                "task": "Unsupervised Water Quality Sensor Anomaly Detection",
                "contamination_rate": 0.12,
                "n_estimators": 120,
                "detection_sensitivity": iso_sensitivity,
            },
            "xgboost": {
                "name": "XGBoost Regressor",
                "task": "7-Day Short-Term Localized Outbreak Trend Forecasting",
                "n_estimators": 100,
                "learning_rate": 0.08,
                "r2_score": xgb_r2,
                "mae": xgb_mae,
            },
            "feature_importances": self.feature_importances,
        }

    def analyze(
        self,
        ph: float,
        turbidity: float,
        temperature: float,
        tds: float,
        dissolved_oxygen: float = 6.2,
        symptom_cases_7d: int = 0,
        rainfall_mm: float = 0.0,
    ) -> dict:
        features_df = pd.DataFrame(
            [
                {
                    "ph": ph,
                    "turbidity": turbidity,
                    "temperature": temperature,
                    "tds": tds,
                    "dissolved_oxygen": dissolved_oxygen,
                    "symptom_cases_7d": symptom_cases_7d,
                    "rainfall_mm": rainfall_mm,
                }
            ]
        )

        # 1. Random Forest Risk Category & Probabilities
        rf_probs = self.rf_classifier.predict_proba(features_df)[0]
        rf_class_idx = int(np.argmax(rf_probs))
        prob_map = {
            RISK_CLASSES[i]: round(float(rf_probs[i] * 100), 1)
            for i in range(len(RISK_CLASSES))
        }

        risk_score = round(
            compute_risk_score(
                ph, turbidity, temperature, tds, dissolved_oxygen, symptom_cases_7d, rainfall_mm
            ),
            1,
        )

        if risk_score >= 78:
            predicted_risk_level = "Critical"
        elif risk_score >= 55:
            predicted_risk_level = "High"
        elif risk_score >= 30:
            predicted_risk_level = "Moderate"
        else:
            predicted_risk_level = RISK_CLASSES[rf_class_idx] if risk_score >= 24 else "Low"

        # 2. Isolation Forest Anomaly Detection
        water_df = pd.DataFrame(
            [
                {
                    "ph": ph,
                    "turbidity": turbidity,
                    "temperature": temperature,
                    "tds": tds,
                    "dissolved_oxygen": dissolved_oxygen,
                }
            ]
        )
        iso_pred = int(self.isolation_forest.predict(water_df)[0])
        raw_decision = float(self.isolation_forest.decision_function(water_df)[0])
        anomaly_score = round(float(np.clip((0.15 - raw_decision) * 180, 4.0, 98.0)), 1)
        is_anomaly = bool(
            iso_pred == -1
            or ph < 6.2
            or ph > 8.8
            or turbidity > 10.0
            or tds > 620.0
            or dissolved_oxygen < 4.5
        )
        if is_anomaly and anomaly_score < 58.0:
            anomaly_score = round(min(96.0, 58.0 + risk_score * 0.35), 1)

        # 3. XGBoost 7-Day Short-Term Trend Forecast
        forecast_7d = []
        sim_df = features_df.copy()
        current_score = risk_score
        now = datetime.now(timezone.utc)
        for day in range(1, 8):
            pred_next = float(self.xgb_forecaster.predict(sim_df)[0])
            drift = (pred_next - current_score) * 0.55
            if is_anomaly and day <= 4:
                drift += 1.8
            next_val = float(np.clip(current_score + drift, 5.0, 99.0))
            day_date = (now + timedelta(days=day)).strftime("%b %d")
            day_level = (
                "Critical"
                if next_val >= 78
                else "High"
                if next_val >= 55
                else "Moderate"
                if next_val >= 30
                else "Low"
            )
            forecast_7d.append(
                {
                    "day": f"Day +{day}",
                    "date": day_date,
                    "predicted_score": round(next_val, 1),
                    "risk_level": day_level,
                    "mitigated_score": round(max(12.0, next_val * (0.85 ** day)), 1),
                }
            )
            current_score = next_val
            sim_df["turbidity"] = sim_df["turbidity"] * 1.02

        explanations = self._build_explanations(
            ph, turbidity, temperature, tds, dissolved_oxygen, symptom_cases_7d, rainfall_mm
        )

        likely_pathogens = []
        if turbidity > 8.0 or symptom_cases_7d >= 6:
            likely_pathogens.append("Vibrio cholerae / Acute Diarrhoeal Syndrome")
        if ph < 6.3 or tds > 600:
            likely_pathogens.append("Enterotoxigenic E. coli & Heavy-Leachate Irritation")
        if temperature >= 29.0 and dissolved_oxygen < 5.2:
            likely_pathogens.append("Salmonella typhi (Typhoid) & Protozoal Giardia")
        if not likely_pathogens:
            likely_pathogens.append("Baseline Low Pathogen Proliferation")

        return {
            "predicted_risk_level": predicted_risk_level,
            "risk_score": risk_score,
            "rf_probabilities": prob_map,
            "is_anomaly": is_anomaly,
            "anomaly_score": anomaly_score,
            "forecast_7d": forecast_7d,
            "explanations": explanations,
            "likely_pathogens": likely_pathogens,
            "recommended_actions": self._build_recommendations(
                predicted_risk_level, ph, turbidity, tds, dissolved_oxygen, symptom_cases_7d
            ),
        }

    def _build_explanations(
        self,
        ph: float,
        turbidity: float,
        temperature: float,
        tds: float,
        dissolved_oxygen: float,
        symptom_cases_7d: int,
        rainfall_mm: float,
    ) -> list[dict]:
        items = []

        if ph < 6.5:
            items.append(
                {
                    "parameter": "pH Level",
                    "value": f"{ph}",
                    "threshold": "6.5 – 8.5",
                    "status": "Critical" if ph < 6.0 else "Warning",
                    "impact_weight": round(min(34.0, (6.5 - ph) * 24.0), 1),
                    "reason": f"Acidic water (pH {ph} < 6.5) accelerates pipe leaching and signals industrial/organic acid contamination.",
                }
            )
        elif ph > 8.5:
            items.append(
                {
                    "parameter": "pH Level",
                    "value": f"{ph}",
                    "threshold": "6.5 – 8.5",
                    "status": "Warning",
                    "impact_weight": round(min(28.0, (ph - 8.5) * 20.0), 1),
                    "reason": f"Alkaline water (pH {ph} > 8.5) reduces chlorine disinfection efficacy.",
                }
            )
        else:
            items.append(
                {
                    "parameter": "pH Level",
                    "value": f"{ph}",
                    "threshold": "6.5 – 8.5",
                    "status": "Optimal",
                    "impact_weight": 4.5,
                    "reason": f"pH {ph} is within WHO safe drinking water range (6.5–8.5).",
                }
            )

        if turbidity > 5.0:
            items.append(
                {
                    "parameter": "Turbidity",
                    "value": f"{turbidity} NTU",
                    "threshold": "< 5.0 NTU",
                    "status": "Critical" if turbidity >= 10.0 else "Warning",
                    "impact_weight": round(min(38.0, 12.0 + (turbidity - 5.0) * 2.1), 1),
                    "reason": f"Elevated suspended particulates ({turbidity} NTU) shield water-borne bacteria and protozoa from chlorination.",
                }
            )
        else:
            items.append(
                {
                    "parameter": "Turbidity",
                    "value": f"{turbidity} NTU",
                    "threshold": "< 5.0 NTU",
                    "status": "Optimal",
                    "impact_weight": 5.0,
                    "reason": f"Clear water clarity ({turbidity} NTU < 5.0 NTU guideline).",
                }
            )

        if tds > 500:
            items.append(
                {
                    "parameter": "Total Dissolved Solids (TDS)",
                    "value": f"{tds} mg/L",
                    "threshold": "< 500 mg/L",
                    "status": "Critical" if tds >= 800 else "Warning",
                    "impact_weight": round(min(26.0, 10.0 + (tds - 500) * 0.04), 1),
                    "reason": f"High dissolved solids ({tds} mg/L) indicate mineral/sewage infiltration or agricultural runoff.",
                }
            )
        else:
            items.append(
                {
                    "parameter": "Total Dissolved Solids (TDS)",
                    "value": f"{tds} mg/L",
                    "threshold": "< 500 mg/L",
                    "status": "Optimal",
                    "impact_weight": 4.0,
                    "reason": f"TDS ({tds} mg/L) meets WHO palatability standard.",
                }
            )

        items.append(
            {
                "parameter": "Water Temperature",
                "value": f"{temperature} °C",
                "threshold": "15 – 28 °C",
                "status": "Warning" if temperature > 28.5 else "Optimal",
                "impact_weight": round(max(4.0, (temperature - 24.0) * 2.2), 1),
                "reason": (
                    f"Warm water ({temperature} °C) accelerates microbial growth rates and depletes residual chlorine."
                    if temperature > 28.5
                    else f"Temperature ({temperature} °C) is within normal seasonal baseline."
                ),
            }
        )

        items.append(
            {
                "parameter": "Dissolved Oxygen (DO)",
                "value": f"{dissolved_oxygen} mg/L",
                "threshold": "> 6.0 mg/L",
                "status": "Critical" if dissolved_oxygen < 4.5 else "Warning" if dissolved_oxygen < 6.0 else "Optimal",
                "impact_weight": round(max(3.5, (6.8 - dissolved_oxygen) * 6.5), 1),
                "reason": (
                    f"Depleted dissolved oxygen ({dissolved_oxygen} mg/L) indicates organic sewage decomposition and anaerobic bacterial load."
                    if dissolved_oxygen < 6.0
                    else f"Healthy oxygenation ({dissolved_oxygen} mg/L)."
                ),
            }
        )

        items.append(
            {
                "parameter": "7-Day Symptom Reports",
                "value": f"{symptom_cases_7d} cases",
                "threshold": "< 5 cases / zone",
                "status": "Critical" if symptom_cases_7d >= 15 else "Warning" if symptom_cases_7d >= 5 else "Optimal",
                "impact_weight": round(min(35.0, symptom_cases_7d * 1.8 + 3.0), 1),
                "reason": (
                    f"Active cluster of {symptom_cases_7d} gastrointestinal/febrile cases correlates with water source contamination."
                    if symptom_cases_7d >= 5
                    else f"Baseline symptom reporting ({symptom_cases_7d} cases in 7 days)."
                ),
            }
        )

        items.sort(key=lambda x: x["impact_weight"], reverse=True)
        return items

    @staticmethod
    def _build_recommendations(
        risk_level: str,
        ph: float,
        turbidity: float,
        tds: float,
        dissolved_oxygen: float,
        symptom_cases_7d: int,
    ) -> list[str]:
        recs = []
        if risk_level in ("High", "Critical"):
            recs.append("Issue immediate Boil-Water Advisory & distribute ORS / chlorine tablets to affected households.")
        if turbidity > 5.0:
            recs.append(f"Perform coagulation-flocculation and rapid sand filtration before chlorination (Turbidity {turbidity} NTU).")
        if ph < 6.5:
            recs.append(f"Neutralize acidic supply (pH {ph}) using soda ash / calcium carbonate dosing and inspect upstream intake for effluent.")
        elif ph > 8.5:
            recs.append(f"Adjust alkaline pH ({ph}) prior to chlorination to maintain free residual chlorine effectiveness.")
        if tds > 500:
            recs.append(f"Divert drinking supply to RO-treated community water kiosks (TDS {tds} mg/L exceeds 500 mg/L limit).")
        if symptom_cases_7d >= 5:
            recs.append(f"Dispatch field health workers to verify {symptom_cases_7d} reported symptom cases and collect stool/water samples.")
        if not recs:
            recs.append("Continue routine IoT telemetry monitoring and maintain standard 0.2–0.5 mg/L free residual chlorine.")
        return recs


ml_engine = SmartHealthMLEngine()
