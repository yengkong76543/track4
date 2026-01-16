from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json
from datetime import datetime

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def index():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()

def get_client_ip(request: Request):
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()

    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip

    if request.client:
        return request.client.host

    return "unknown"

@app.post("/collect")
async def collect(request: Request):
    data = await request.json()

    log = {
        "type": "request",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "ip": get_client_ip(request),
        "user_agent": request.headers.get("user-agent"),
        "url": str(request.url),
        "method": request.method,
        "fingerprint": data
    }

    print("========== NEW FINGERPRINT ==========")
    print(json.dumps(log, indent=2))
    print("=====================================")

    return {"status": "ok"}
