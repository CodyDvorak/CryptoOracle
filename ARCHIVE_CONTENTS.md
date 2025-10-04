# Crypto Oracle - Code Archive Contents

**Archive Name**: `crypto_oracle_code.zip`  
**Size**: 169 KB (compressed)  
**Created**: October 4, 2025  
**Format**: ZIP Archive

---

## 📦 Archive Contents

### 📁 Backend (Python/FastAPI)

#### Core Files
- `backend/server.py` (49.6 KB) - Main FastAPI application with all API endpoints

#### Services Directory (`backend/services/`)
**Data Provider Clients:**
- `coinmarketcap_client.py` (12.2 KB) - CoinMarketCap API integration
- `coingecko_client.py` (12.2 KB) - CoinGecko API integration
- `cryptocompare_client.py` (11.9 KB) - CryptoCompare API integration
- `okx_futures_client.py` (10.4 KB) - OKX futures data client
- `coinalyze_client.py` (21.2 KB) - Coinalyze derivatives client
- `binance_futures_client.py` (12.6 KB) - Binance futures client
- `bybit_futures_client.py` (11.3 KB) - Bybit futures client
- `binance_client.py` (7.5 KB) - Binance spot data client
- `tokenmetrics_client.py` (13.4 KB) - TokenMetrics integration

**Multi-Provider Systems:**
- `multi_provider_client.py` (10.8 KB) - OHLCV data fallback orchestrator
- `multi_futures_client.py` (4.9 KB) - Futures data fallback orchestrator

**Core Services:**
- `scan_orchestrator.py` (86.3 KB) - Main scan logic with 15 scan types
- `bot_performance_service.py` (35.8 KB) - Bot tracking and analytics
- `aggregation_engine.py` (10.0 KB) - Bot result aggregation
- `indicator_engine.py` (12.6 KB) - Technical indicator computation
- `market_regime_classifier.py` (10.7 KB) - Market condition detection
- `scan_monitor.py` (3.9 KB) - Real-time scan status tracking
- `outcome_tracker.py` (10.8 KB) - Prediction evaluation system

**AI/LLM Services:**
- `sentiment_analysis_service.py` (5.1 KB) - Sentiment analysis
- `llm_synthesis_service.py` (5.8 KB) - LLM rationale generation

**Utility Services:**
- `auth_service.py` (2.2 KB) - Authentication utilities
- `email_service.py` (5.9 KB) - Email notifications
- `google_sheets_service.py` (4.1 KB) - Sheets integration

#### Bots Directory (`backend/bots/`)
- `bot_strategies.py` (105.1 KB) - All 54 trading bot implementations
- `bot_strategies.py.backup` (38.9 KB) - Backup copy

#### Models Directory (`backend/models/`)
- `models.py` (11.7 KB) - Pydantic data models for all entities

#### Dependencies
- `requirements.txt` (2.4 KB) - Python package dependencies

---

### 📁 Frontend (React)

#### Core Files
- `frontend/src/index.js` (602 B) - React entry point
- `frontend/src/App.js` (deflated) - Main application component
- `frontend/src/App.css` (88 B) - Global styles
- `frontend/src/index.css` - Tailwind CSS configuration
- `frontend/src/AppRouter.js` (1.3 KB) - Route configuration

#### Pages (`frontend/src/pages/`)
- `Login.js` (3.4 KB) - Login page component
- `Register.js` (5.0 KB) - Registration page component
- `History.js` (13.5 KB) - Scan history page

#### Components (`frontend/src/components/`)
- `BotPerformanceDashboard.js` (34.1 KB) - Analytics dashboard
- `DashboardComponents.js` (12.3 KB) - Recommendation cards
- `BotDetailsModal.js` (5.9 KB) - Bot breakdown modal
- `NotificationSidebar.js` (5.0 KB) - Notification panel

#### UI Components (`frontend/src/components/ui/`)
- `button.js` (1.0 KB) - Button component
- `card.js` (1.5 KB) - Card component
- `dialog.js` (1.8 KB) - Modal dialog
- `input.js` (622 B) - Input field
- `label.js` (381 B) - Label component
- `select.js` (839 B) - Select dropdown
- `switch.js` (1.1 KB) - Toggle switch
- `tabs.js` (1.7 KB) - Tab navigation
- `sonner.js` (369 B) - Toast notifications

#### Contexts (`frontend/src/contexts/`)
- `AuthContext.js` (3.9 KB) - Authentication state management
- `NotificationContext.js` (2.4 KB) - Notification state management

#### Utilities (`frontend/src/lib/`)
- `utils.js` (78 B) - Utility functions

#### Public Assets (`frontend/public/`)
- `index.html` - HTML template

#### Dependencies
- `package.json` - NPM package dependencies

---

### 📁 Documentation

- `README.md` (72% compressed) - Complete user and developer guide with all 15 scan types
- `TECHNICAL_SUMMARY.md` (61% compressed) - Technical status report and implementation details
- `AI_CODING_ASSISTANT_PROMPT.md` (62% compressed) - AI assistant prompt for code review and debugging

---

## 📊 File Statistics

**Total Files**: 60+  
**Backend Files**: 32  
**Frontend Files**: 25+  
**Documentation Files**: 3

**Total Code Size** (uncompressed): ~700 KB  
**Compressed Size**: 169 KB  
**Compression Ratio**: 76%

---

## 🗂️ Key Features Included

### Backend Features
✅ 15 different scan types (speed_run to all_in_ai)  
✅ 54 trading bot strategies  
✅ Multi-provider data fallback (3 OHLCV, 4 futures)  
✅ Market regime classification  
✅ Multi-timeframe analysis (daily + 4h)  
✅ Bot performance tracking  
✅ Prediction outcome evaluation  
✅ LLM-powered sentiment analysis  
✅ Real-time scan monitoring  

### Frontend Features
✅ User authentication (login/register)  
✅ Dashboard with recommendation cards  
✅ Bot performance analytics  
✅ Bot details modal  
✅ Scan history  
✅ Real-time notifications  
✅ Market regime badges  
✅ Responsive UI components  

### Documentation
✅ Complete README with all scan types  
✅ Technical summary and status report  
✅ AI coding assistant prompt  
✅ API documentation  
✅ Setup and deployment guides  

---

## 🚀 How to Use This Archive

### 1. Extract the Archive
```bash
unzip crypto_oracle_code.zip -d crypto_oracle
cd crypto_oracle
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Configure .env file
echo "MONGO_URL=mongodb://localhost:27017" > .env
echo "DB_NAME=crypto_oracle" >> .env
echo "COINMARKETCAP_API_KEY=your_key_here" >> .env

# Run backend
python server.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install  # or yarn install

# Configure .env file
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

# Run frontend
npm start  # or yarn start
```

### 4. Review Documentation
```bash
cat README.md  # Full guide with all scan types
cat TECHNICAL_SUMMARY.md  # Status and implementation details
cat AI_CODING_ASSISTANT_PROMPT.md  # For AI code review
```

---

## 🔑 Important Notes

### Not Included in Archive
- `.git/` directory (version control history)
- `node_modules/` (can be reinstalled with npm/yarn)
- `__pycache__/` (Python cache)
- `.env` files (need to be created with your API keys)
- `*.log` files
- `venv/` (Python virtual environment)

### Required API Keys
You'll need to obtain and configure:
- CoinMarketCap API key
- Coinalyze API key (optional)
- MongoDB connection string

### System Requirements
- Python 3.11+
- Node.js 18+
- MongoDB 5.0+
- 2GB RAM minimum
- 500MB disk space

---

## 📞 Support

For questions about the code:
1. Read `README.md` for feature documentation
2. Check `TECHNICAL_SUMMARY.md` for implementation details
3. Use `AI_CODING_ASSISTANT_PROMPT.md` to onboard AI assistants

---

**Archive Created By**: AI Development Team  
**Last Updated**: October 4, 2025  
**Version**: 1.0.0 (Phase 1 Complete)
