# MongoDB to Supabase Migration Guide

## Overview

This document describes the migration from MongoDB (Motor) to Supabase PostgreSQL for the Crypto Oracle application.

## What Changed

### Database Layer

1. **Removed MongoDB Dependencies**
   - Removed `motor==3.3.1` and `pymongo==4.5.0`
   - Added `supabase==2.3.4` and `postgrest==0.13.2`

2. **New Database Client**
   - Created `/backend/database/supabase_client.py`
   - Provides MongoDB-like interface for easy migration
   - Supports familiar methods: `find_one()`, `find()`, `insert_one()`, `update_one()`, etc.

3. **Updated Service Files**
   - `server.py` - Main FastAPI server
   - `services/scan_orchestrator.py` - Scan coordination
   - `services/outcome_tracker.py` - Outcome tracking
   - `services/bot_performance_service.py` - Bot analytics
   - `services/aggregation_engine.py` - Data aggregation

### Database Schema

Created complete PostgreSQL schema with:
- **users** - User authentication
- **scan_runs** - Scan execution tracking
- **recommendations** - Trading recommendations
- **bot_predictions** - Individual bot predictions
- **bot_performance** - Bot performance metrics
- **parameter_snapshots** - Bot parameter history
- **integrations_config** - Email/Sheets configuration
- **settings** - Application settings

All tables include:
- Row Level Security (RLS) policies
- Proper indexes for performance
- Foreign key relationships
- Default values

### Environment Configuration

**Backend (.env):**
```env
SUPABASE_URL=https://pdapmnhptjjglsqddwsw.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-secret-key
```

**Frontend (.env):**
```env
REACT_APP_BACKEND_URL=http://localhost:8000
VITE_SUPABASE_URL=https://pdapmnhptjjglsqddwsw.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Setup Instructions

### Prerequisites

- Python 3.8+
- Node.js 16+
- Supabase account (already configured)

### Installation

1. **Install Dependencies**

   ```bash
   # Install root dependencies
   npm install

   # Or install separately
   cd frontend && npm install
   cd ../backend && pip install -r requirements.txt
   ```

2. **Configure Environment**

   Ensure `.env` files are properly configured in:
   - `/backend/.env` (backend configuration)
   - `/frontend/.env` (frontend configuration)
   - `/.env` (root configuration)

3. **Database Migration**

   The database schema has already been created via Supabase migrations.
   All tables, indexes, and RLS policies are in place.

### Running the Application

**Development Mode (Both servers):**
```bash
npm run dev
```

**Separate Servers:**
```bash
# Backend
npm run dev:backend
# or
cd backend && uvicorn server:app --reload --port 8000

# Frontend
npm run dev:frontend
# or
cd frontend && npm start
```

**Build Frontend:**
```bash
npm run build
```

## Migration Details

### Code Changes

1. **Database Client Initialization**
   ```python
   # Old (MongoDB)
   from motor.motor_asyncio import AsyncIOMotorClient
   client = AsyncIOMotorClient(mongo_url)
   db = client['crypto_oracle']

   # New (Supabase)
   from database.supabase_client import get_supabase_client
   db = get_supabase_client()
   ```

2. **Collection Access**
   ```python
   # Old (MongoDB)
   await db.scan_runs.find_one({'id': run_id})

   # New (Supabase)
   await db.collection('scan_runs').find_one({'id': run_id})
   ```

3. **Query Patterns**
   The Supabase client provides the same interface:
   - `find_one(query)` - Find single document
   - `find(query).sort().limit().to_list()` - Find multiple
   - `insert_one(document)` - Insert document
   - `update_one(query, update, upsert=False)` - Update document
   - `delete_one(query)` - Delete document
   - `count_documents(query)` - Count matches

### Data Migration

If you have existing MongoDB data to migrate:

1. **Export from MongoDB**
   ```bash
   mongoexport --db crypto_oracle --collection users --out users.json
   mongoexport --db crypto_oracle --collection scan_runs --out scan_runs.json
   # ... repeat for all collections
   ```

2. **Transform and Import to Supabase**

   You'll need to:
   - Convert MongoDB ObjectIds to UUIDs
   - Transform date formats to ISO strings
   - Map field names if needed
   - Use Supabase client or SQL to insert data

   Example transformation script:
   ```python
   import json
   from database.supabase_client import get_supabase_client

   db = get_supabase_client()

   # Load MongoDB export
   with open('users.json') as f:
       users = json.load(f)

   # Transform and insert
   for user in users:
       # Remove MongoDB _id
       user.pop('_id', None)

       # Insert into Supabase
       await db.collection('users').insert_one(user)
   ```

## Testing

1. **Test Database Connection**
   ```python
   from database.supabase_client import get_supabase_client

   db = get_supabase_client()
   result = await db.collection('users').find_one({})
   print("Connection successful:", result is not None)
   ```

2. **Test API Endpoints**
   ```bash
   # Health check
   curl http://localhost:8000/api/health

   # Register user
   curl -X POST http://localhost:8000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"test","email":"test@example.com","password":"test123"}'
   ```

## Troubleshooting

### Common Issues

1. **Import Error: No module named 'database'**
   - Ensure you're running from the `backend` directory
   - Or add `backend` to PYTHONPATH

2. **Connection Error: SUPABASE_URL not found**
   - Check `.env` file exists in `backend/` directory
   - Verify environment variables are loaded

3. **RLS Policy Errors**
   - Ensure you're using the service role key for backend operations
   - Frontend should use anon key

4. **UUID vs String IDs**
   - All IDs are now UUIDs (strings in API responses)
   - Pydantic models still use `str` type for compatibility

## Performance Considerations

1. **Indexes**: All foreign keys and frequently queried fields are indexed
2. **Connection Pooling**: Supabase client handles connection pooling
3. **Query Optimization**: Use `.select()` to limit returned fields when possible

## Security

1. **RLS Policies**: All tables have Row Level Security enabled
2. **Service Role Key**: Only use in backend, never expose to frontend
3. **JWT Authentication**: Continue using same JWT auth flow
4. **User Isolation**: Users can only access their own data

## Next Steps

1. ✅ Database schema created
2. ✅ Backend migrated to Supabase
3. ✅ Environment configured
4. ⏳ Test all endpoints
5. ⏳ Migrate existing data (if any)
6. ⏳ Deploy to production

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Review PostgreSQL docs: https://www.postgresql.org/docs/
- Supabase Python client: https://github.com/supabase-community/supabase-py
