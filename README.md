# hvppyspeak

```bash
cd ~/english-trainer
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
python server.py
# 또는
# CSV_PATH="data/cards.csv" uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```