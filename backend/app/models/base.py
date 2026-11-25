from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Models mirror `supabase/migrations`; every relationship uses `lazy="raise"`."""
