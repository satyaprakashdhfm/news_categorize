from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # API Keys
    GOOGLE_API_KEY: str
    TVLY_API_KEY: str
    
    # Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Optional
    SHOW_DB_LOGS: str = "false"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
