import json
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def index():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()

@app.post("/collect")
async def collect(request: Request):
    data = await request.json()

    print("========== NEW FINGERPRINT ==========")
    print(json.dumps(data, indent=2))
    print("=====================================")

    return {"status": "ok"}
