import json
from pathlib import Path

from app.main import app

OUTPUT = Path(__file__).resolve().parents[1] / "openapi.json"


def main() -> None:
    """Write the OpenAPI schema deterministically; run with `python -m scripts.export_openapi`."""
    OUTPUT.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
