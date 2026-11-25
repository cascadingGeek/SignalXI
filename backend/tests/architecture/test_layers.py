"""Spec 0001 rules import-linter cannot express: layer map, allowlists, purity, paywall."""

import ast
import sys
from functools import cache
from pathlib import Path

import grimp
import pytest

APP_DIR = Path(__file__).resolve().parents[2] / "app"

LAYERS: tuple[tuple[str, int], ...] = (
    ("app.main", 1),
    ("app.core.scheduler", 1),
    ("app.http", 2),
    ("app.routes", 3),
    ("app.workers", 3),
    ("app.core.dependency", 4),
    ("app.core.container", 5),
    ("app.controllers", 6),
    ("app.services", 7),
    ("app.workflow", 8),
    ("app.repositories", 9),
    ("app.tools", 9),
    ("app.models", 10),
    ("app.core.database", 11),
    ("app.core.redis", 11),
    ("app.core.telemetry", 11),
    ("app.core.security", 11),
    ("app.core.config", 12),
    ("app.core.errors", 12),
    ("app.knowledge", 13),
    ("app.schemas", 14),
    ("app.utils", 15),
)
UNMAPPED_OK = {"app", "app.core"}

ALLOWLISTS: dict[str, set[str]] = {
    "app.routes": {"fastapi", "app.controllers", "app.core.dependency", "app.schemas"},
    "app.controllers": {
        "app.services",
        "app.schemas",
        "app.knowledge",
        "app.utils",
        "app.core.errors",
        "app.core.config",
        "app.controllers.presenter",
    },
    "app.workers": {
        "app.core.container",
        "app.services",
        "app.schemas",
        "app.utils",
        "app.core.config",
        "app.core.errors",
        "app.core.telemetry",
    },
    "app.services.statistical_engine": {
        "numpy",
        "scipy",
        "app.schemas",
        "app.utils",
        "app.knowledge",
        "app.core.errors",
    },
}
ENGINE = "app.services.statistical_engine"
ENGINE_BANNED_STDLIB = {"os", "sys", "time", "random", "socket", "subprocess", "pathlib", "io"}
ENGINE_BANNED_CALLS = {"datetime.now", "datetime.utcnow", "date.today"}

PUBLIC_RESPONSE_TYPES: frozenset[str] = frozenset()
PRESENTER = "app.controllers.presenter"


def _module_name(path: Path) -> str:
    rel = path.relative_to(APP_DIR.parent).with_suffix("")
    parts = list(rel.parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


@cache
def _modules() -> dict[str, ast.Module]:
    return {
        _module_name(path): ast.parse(path.read_text(), filename=str(path))
        for path in sorted(APP_DIR.rglob("*.py"))
    }


def _layer_of(module: str) -> int | None:
    best: tuple[int, int] | None = None
    for prefix, layer in LAYERS:
        if (module == prefix or module.startswith(prefix + ".")) and (
            best is None or len(prefix) > best[0]
        ):
            best = (len(prefix), layer)
    return None if best is None else best[1]


def _imports(tree: ast.Module, module: str) -> set[str]:
    names: set[str] = set()
    package = module if module in {"app"} else module.rsplit(".", 1)[0]
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:
                anchor = package.split(".")
                anchor = anchor[: len(anchor) - (node.level - 1)]
                base = ".".join([*anchor, base]) if base else ".".join(anchor)
            names.add(base)
            names.update(f"{base}.{alias.name}" for alias in node.names)
    return names


def _allowed(name: str, allow: set[str]) -> bool:
    return any(name == item or name.startswith(item + ".") for item in allow)


def _is_stdlib(name: str) -> bool:
    return name.split(".")[0] in sys.stdlib_module_names


def _is_app_module(name: str) -> bool:
    return name in _modules() or any(m.startswith(name + ".") for m in _modules())


def test_every_module_maps_to_one_layer() -> None:
    unmapped = [m for m in _modules() if m not in UNMAPPED_OK and _layer_of(m) is None]
    assert not unmapped, f"add these modules to a layer in spec 0001 and LAYERS: {unmapped}"


def test_core_init_stays_empty() -> None:
    assert _modules()["app.core"].body == []


@pytest.mark.parametrize("scope", sorted(ALLOWLISTS))
def test_direct_import_allowlists(scope: str) -> None:
    allow = ALLOWLISTS[scope]
    violations: list[str] = []
    for module, tree in _modules().items():
        if not (module == scope or module.startswith(scope + ".")):
            continue
        if scope == "app.controllers" and module == PRESENTER:
            continue
        if scope == "app.services" and module != ENGINE:
            continue
        for name in _imports(tree, module):
            top = name.split(".")[0]
            if name == module or name.startswith(module + "."):
                continue
            if top == "app":
                if not _is_app_module(name) and _is_app_module(name.rsplit(".", 1)[0]):
                    continue
                ok = _allowed(name, allow)
                if scope == "app.controllers" and name.startswith(PRESENTER):
                    ok = module.endswith("_controller")
            elif _is_stdlib(name):
                ok = not (module == ENGINE and top in ENGINE_BANNED_STDLIB)
            else:
                ok = _allowed(top, allow) or _allowed(name, allow)
            if not ok:
                violations.append(f"{module} imports {name}")
    assert not violations, "\n".join(sorted(set(violations)))


def test_statistical_engine_call_bans() -> None:
    tree = _modules().get(ENGINE)
    if tree is None:
        pytest.skip("statistical engine not built yet")
    violations: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        target = ast.unparse(node.func)
        if any(target.endswith(banned) for banned in ENGINE_BANNED_CALLS):
            violations.append(f"line {node.lineno}: {target}()")
        is_rng = ".random." in f".{target}." and target.split(".")[-1] == "default_rng"
        if is_rng and not node.args and not node.keywords:
            violations.append(f"line {node.lineno}: unseeded {target}()")
    assert not violations, "\n".join(violations)


def test_no_cycles_between_services() -> None:
    graph = grimp.build_graph("app")
    services = sorted(m for m in graph.modules if m.startswith("app.services."))
    cycles = [
        f"{a} <-> {b}"
        for i, a in enumerate(services)
        for b in services[i + 1 :]
        if graph.find_shortest_chain(a, b) and graph.find_shortest_chain(b, a)
    ]
    assert not cycles, "\n".join(cycles)


def test_public_responses_built_only_in_presenter() -> None:
    violations: list[str] = []
    for module, tree in _modules().items():
        if module == PRESENTER or module.startswith("app.schemas"):
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                called = ast.unparse(node.func).split(".")[-1]
                if called in PUBLIC_RESPONSE_TYPES:
                    violations.append(f"{module}:{node.lineno} builds {called}")
    assert not violations, "\n".join(violations)
