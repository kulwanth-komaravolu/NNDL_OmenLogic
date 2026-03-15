from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os
import tensorflow as tf
import pandas as pd
import numpy as np
import joblib

app = FastAPI()

base_dir = os.path.dirname(os.path.realpath(__file__))
static_path = os.path.join(base_dir, "static")
csv_path = os.path.join(base_dir, "bank_customers_data.csv")
model_path = os.path.join(base_dir, "models")
templates = Jinja2Templates(directory=os.path.join(base_dir, "views"))


# Define your custom routes
@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# Load assets
df = pd.read_csv(csv_path)
model = tf.keras.models.load_model(os.path.join(model_path, "nndl_churn_model.h5"))
scaler = joblib.load(os.path.join(model_path, "scaler.pkl"))
feature_cols = joblib.load(os.path.join(model_path, "model_features.pkl"))


# Pre-calculate predictions for speed
X_data = df.drop(
    columns=[
        "customerId",
        "bankId",
        "name",
        "bankName",
        "managerId",
        "managerName",
        "Churn",
    ],
    errors="ignore",
)
X_data = pd.get_dummies(X_data, drop_first=True)

# Ensure columns match training exactly
X_data = X_data.reindex(columns=feature_cols, fill_value=0)

X_scaled = scaler.transform(X_data)
df["Churn_Prob"] = model.predict(X_scaled).flatten() * 100


@app.get("/api/portal")
async def get_portal():
    # FastAPI automatically handles dict-to-JSON conversion
    banks = (
        df[["bankId", "bankName", "managerName"]].drop_duplicates().to_dict("records")
    )

    return {"banks": banks}


@app.get("/api/bank/{bank_id}")
async def get_bank_data(bank_id: str):  # Type hint ensures bank_id is a string
    bank_df = df[df["bankId"] == bank_id]

    if bank_df.empty:
        raise HTTPException(status_code=404, detail="Bank not found")

    total = len(bank_df)
    at_risk = len(bank_df[bank_df["Churn_Prob"] > 60])
    top_risk = bank_df.sort_values(by="Churn_Prob", ascending=False).head(5)

    return {
        "bank_name": str(bank_df["bankName"].iloc[0]),
        "manager": str(bank_df["managerName"].iloc[0]),
        "total": int(total),
        "at_risk": int(at_risk),
        "safe": int(total - at_risk),
        "top_risk": top_risk[["customerId", "name", "Churn_Prob"]].to_dict("records"),
        "all_customers": bank_df[
            ["customerId", "name", "tenure", "monthlyCharges", "Churn_Prob"]
        ].to_dict("records"),
    }


@app.get("/api/analyze/{cust_id}")
async def analyze_customer(cust_id: str):
    customer_match = df[df["customerId"] == cust_id]

    if customer_match.empty:
        raise HTTPException(status_code=404, detail="Customer not found")

    cust = customer_match.iloc[0]
    prob = cust["Churn_Prob"]

    return {
        "id": str(cust["customerId"]),
        "name": str(cust["name"]),
        "contract": str(cust["contractType"]),
        "billing": float(cust["monthlyCharges"]),
        "tenure": int(cust["tenure"]),
        "calls": int(cust["supportCalls"]),
        "prob": float(round(prob, 1)),
    }


# Mount static files
app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
