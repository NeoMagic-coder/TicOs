"""Commerce Control Layer — unified AI oversight for e-commerce modules.

Aggregates product, stock, order, support and fraud signals; evaluates
proposed actions through the autonomy decision engine; surfaces human
approval when confidence or risk exceeds policy thresholds.
"""
from apps.api.core.commerce.orchestrator import CommerceControlOrchestrator, get_commerce_orchestrator

__all__ = ["CommerceControlOrchestrator", "get_commerce_orchestrator"]
