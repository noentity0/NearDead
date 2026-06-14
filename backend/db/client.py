import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache(maxsize=1)
def get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        return None

    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}. Falling back to demo store.")
        return None


def using_demo_store() -> bool:
    return get_supabase() is None
