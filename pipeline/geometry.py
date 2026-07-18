"""Geometry utilities shared by validation, diff and publication."""
from __future__ import annotations

from collections.abc import Iterable
from functools import lru_cache

from pyproj import Transformer
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform, unary_union


@lru_cache(maxsize=1)
def _equal_area_transformer() -> Transformer:
    return Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)


def area_km2(geometry) -> float:
    """Return geodesically suitable equal-area surface in square kilometres."""
    if geometry is None or geometry.is_empty:
        return 0.0
    projected = transform(_equal_area_transformer().transform, geometry)
    return abs(projected.area) / 1_000_000


def features_by_status(payload: dict) -> dict[str, object]:
    grouped: dict[str, list] = {}
    for feature in payload.get("features", []):
        status = feature.get("properties", {}).get("status", "unknown")
        grouped.setdefault(status, []).append(shape(feature["geometry"]))
    return {status: unary_union(geometries) for status, geometries in grouped.items()}


def polygon_parts(geometry) -> Iterable[Polygon]:
    if geometry is None or geometry.is_empty:
        return []
    if isinstance(geometry, Polygon):
        return [geometry]
    if isinstance(geometry, MultiPolygon):
        return list(geometry.geoms)
    if isinstance(geometry, GeometryCollection):
        return [part for geom in geometry.geoms for part in polygon_parts(geom)]
    return []


def as_geojson(geometry) -> dict:
    return mapping(geometry)
