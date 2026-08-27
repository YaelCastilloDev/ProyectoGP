"""OpenTelemetry wiring.

Traces: FastAPI auto-instrumentation plus manual spans on business operations.
Exporters: console (dev, opt-in) and OTLP/gRPC (opt-in, set OTLP_ENDPOINT).
Metrics: request-relevant business counters and histograms.

The instrumentation is intentionally self-contained so it can be disabled
without affecting the rest of the application.
"""

import logging
from collections.abc import Callable
from functools import wraps
from typing import Any

from fastapi import FastAPI
from opentelemetry import metrics, trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import ConsoleMetricExporter, PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.trace import Span, Status, StatusCode

from backend.app.config import Settings

logger = logging.getLogger(__name__)

_telemetry_configured = False


def _get_optional_otlp_exporter():
    try:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (  # type: ignore
            OTLPSpanExporter,
        )

        return OTLPSpanExporter
    except ImportError:  # pragma: no cover - depends on optional dependency
        return None


def setup_telemetry(app: FastAPI, settings: Settings) -> trace.Tracer:
    """Configure providers, instrument the app and return a tracer."""
    global _telemetry_configured
    if _telemetry_configured:
        return trace.get_tracer(settings.service_name)
    _telemetry_configured = True

    resource = Resource.create({"service.name": settings.service_name})

    tracer_provider = TracerProvider(resource=resource)
    if settings.otel_console:
        tracer_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    if settings.otlp_endpoint:
        exporter_cls = _get_optional_otlp_exporter()
        if exporter_cls is not None:
            tracer_provider.add_span_processor(
                BatchSpanProcessor(exporter_cls(endpoint=settings.otlp_endpoint, insecure=True))
            )
        else:
            logger.warning(
                "OTLP endpoint configured but the gRPC exporter is not installed; "
                "add `opentelemetry-exporter-otlp-proto-grpc` to send traces."
            )
    trace.set_tracer_provider(tracer_provider)

    metric_readers = []
    if settings.otel_console:
        metric_readers.append(PeriodicExportingMetricReader(ConsoleMetricExporter()))
    metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=metric_readers))

    FastAPIInstrumentor.instrument_app(app)

    app.state.meter = metrics.get_meter(settings.service_name)
    return trace.get_tracer(settings.service_name)


def _start_span(tracer: trace.Tracer, name: str) -> Span | None:
    """Start a span only when a recording tracer is active."""
    current = trace.get_current_span()
    if not current.is_recording():
        return None
    return tracer.start_span(name)


def traced(name: str) -> Callable:
    """Decorator wrapping a coroutine in a span named `name`."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            span = _start_span(trace.get_tracer(__name__), name)
            if span is None:
                return await func(*args, **kwargs)
            with trace.use_span(span, end_on_exit=True):
                try:
                    return await func(*args, **kwargs)
                except Exception:
                    span.set_status(Status(StatusCode.ERROR))
                    raise

        return wrapper

    return decorator
