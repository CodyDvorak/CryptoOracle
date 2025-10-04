"""
Supabase database client for Crypto Oracle.

This module provides a unified async interface for database operations,
replacing the MongoDB Motor client with Supabase PostgreSQL.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from supabase import create_client, Client
from postgrest.base_request_builder import APIResponse

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Async wrapper for Supabase client with MongoDB-like interface."""

    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)
        self.url = url
        self.key = key
        logger.info("Supabase client initialized")

    def collection(self, table_name: str):
        """Get a collection interface (MongoDB-like)."""
        return SupabaseCollection(self.client, table_name)


class SupabaseCollection:
    """
    MongoDB-like collection interface for Supabase tables.

    Provides familiar methods like find_one(), find(), insert_one(), update_one()
    to make migration from MongoDB easier.
    """

    def __init__(self, client: Client, table_name: str):
        self.client = client
        self.table_name = table_name
        self._table = client.table(table_name)

    async def find_one(self, query: Dict[str, Any] = None, sort: List = None) -> Optional[Dict[str, Any]]:
        """
        Find a single document matching the query.

        Args:
            query: Dictionary of field-value pairs to match
            sort: List of tuples [(field, direction)] where direction is 1 (asc) or -1 (desc)

        Returns:
            Dictionary or None
        """
        try:
            request = self._table.select("*")

            # Apply filters
            if query:
                for key, value in query.items():
                    if isinstance(value, dict) and '$regex' in value:
                        # Handle regex patterns
                        pattern = value['$regex']
                        options = value.get('$options', '')
                        if 'i' in options:
                            request = request.ilike(key, f"%{pattern}%")
                        else:
                            request = request.like(key, f"%{pattern}%")
                    else:
                        request = request.eq(key, value)

            # Apply sorting
            if sort:
                for field, direction in sort:
                    ascending = direction == 1
                    request = request.order(field, desc=not ascending)

            # Limit to 1 result
            response = request.limit(1).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None

        except Exception as e:
            logger.error(f"Error in find_one for {self.table_name}: {e}")
            return None

    async def find(self, query: Dict[str, Any] = None) -> 'SupabaseCursor':
        """
        Find multiple documents matching the query.

        Args:
            query: Dictionary of field-value pairs to match

        Returns:
            SupabaseCursor for chaining operations
        """
        return SupabaseCursor(self._table, query)

    async def insert_one(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Insert a single document.

        Args:
            document: Dictionary representing the document

        Returns:
            Inserted document with generated ID
        """
        try:
            # Remove MongoDB _id if present
            doc = {k: v for k, v in document.items() if k != '_id'}

            # Convert datetime objects to ISO format
            doc = self._serialize_dates(doc)

            response = self._table.insert(doc).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return doc

        except Exception as e:
            logger.error(f"Error in insert_one for {self.table_name}: {e}")
            raise

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> Dict[str, Any]:
        """
        Update a single document.

        Args:
            query: Dictionary of field-value pairs to match
            update: Dictionary with $set operator or direct fields
            upsert: If True, insert if document doesn't exist

        Returns:
            Result dictionary
        """
        try:
            # Extract update data
            if '$set' in update:
                update_data = update['$set']
            else:
                update_data = update

            # Serialize dates
            update_data = self._serialize_dates(update_data)

            # Build request
            request = self._table.update(update_data)

            # Apply filters
            for key, value in query.items():
                request = request.eq(key, value)

            response = request.execute()

            # Handle upsert
            if upsert and (not response.data or len(response.data) == 0):
                # Insert new document
                new_doc = {**query, **update_data}
                return await self.insert_one(new_doc)

            return {
                'matched_count': len(response.data) if response.data else 0,
                'modified_count': len(response.data) if response.data else 0
            }

        except Exception as e:
            logger.error(f"Error in update_one for {self.table_name}: {e}")
            raise

    async def delete_one(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """Delete a single document."""
        try:
            request = self._table.delete()

            for key, value in query.items():
                request = request.eq(key, value)

            response = request.execute()

            return {
                'deleted_count': len(response.data) if response.data else 0
            }

        except Exception as e:
            logger.error(f"Error in delete_one for {self.table_name}: {e}")
            raise

    async def count_documents(self, query: Dict[str, Any] = None) -> int:
        """Count documents matching the query."""
        try:
            request = self._table.select("*", count="exact")

            if query:
                for key, value in query.items():
                    request = request.eq(key, value)

            response = request.execute()
            return response.count if hasattr(response, 'count') else 0

        except Exception as e:
            logger.error(f"Error in count_documents for {self.table_name}: {e}")
            return 0

    def _serialize_dates(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert datetime objects to ISO format strings."""
        result = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = self._serialize_dates(value)
            elif isinstance(value, list):
                result[key] = [
                    self._serialize_dates(item) if isinstance(item, dict)
                    else item.isoformat() if isinstance(item, datetime)
                    else item
                    for item in value
                ]
            else:
                result[key] = value
        return result


class SupabaseCursor:
    """
    MongoDB-like cursor for query chaining.

    Supports: sort(), limit(), to_list()
    """

    def __init__(self, table, query: Dict[str, Any] = None):
        self._table = table
        self._query = query or {}
        self._sort_fields = []
        self._limit_count = None

    def sort(self, field: str, direction: int = 1):
        """Sort results by field."""
        self._sort_fields.append((field, direction))
        return self

    def limit(self, count: int):
        """Limit number of results."""
        self._limit_count = count
        return self

    async def to_list(self, length: int = None):
        """Execute query and return list of results."""
        try:
            request = self._table.select("*")

            # Apply filters
            for key, value in self._query.items():
                request = request.eq(key, value)

            # Apply sorting
            for field, direction in self._sort_fields:
                ascending = direction == 1
                request = request.order(field, desc=not ascending)

            # Apply limit
            limit = length if length is not None else self._limit_count
            if limit is not None:
                request = request.limit(limit)

            response = request.execute()
            return response.data if response.data else []

        except Exception as e:
            logger.error(f"Error executing cursor query: {e}")
            return []


def get_supabase_client() -> SupabaseClient:
    """
    Get initialized Supabase client from environment variables.

    Returns:
        SupabaseClient instance
    """
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")

    return SupabaseClient(url, key)
