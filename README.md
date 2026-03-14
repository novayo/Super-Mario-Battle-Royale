# Super-Mario-Battle-Royale

## Project Structure

- `frontend/`: React + Phaser frontend application.
- `server/`: Python-based WebSocket server.

---

## Getting Started

### Server (Python)

#### Setup
```bash
# Recommended: create a virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r server/requirements.txt
```

#### Commands
- **Start**: `python3 server/main.py`
- **Test**: `python3 -m pytest server/`
- **Coverage**: `python3 -m pytest --cov=server server/`
- **Format**: `python3 -m black server/`
- **Lint**: `python3 -m flake8 server/`

---

### Frontend (React + Phaser)

#### Setup
```bash
cd frontend
npm install
```

#### Commands
- **Start**: `npm run dev`
- **Build**: `npm run build`
- **Copy Proto**: `npm run copy-proto`
- **Test**: `npm test`
- **Coverage**: `npm run coverage`
- **Format**: `npm run format`

---

## License

Copyright (c) 2026 Eric. All rights reserved.

This is a personal portfolio project. The source code is available for viewing and educational purposes only. No license is granted for reproduction, distribution, modification, or commercial use of this code or its assets.
