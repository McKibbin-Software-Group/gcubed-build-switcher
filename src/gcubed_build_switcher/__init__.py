"""
G-Cubed Build Switcher - Dependency management for G-Cubed economic models.

Different G-Cubed economic models have different dependencies on G-Cubed Code library builds.
Python scripts, which run simulations and create projections based on these models,
are aware of the G-Cubed Code library version required by the model.

This module provides a way to manage the dependencies of G-Cubed model simulations
by creating virtual environments specific to each G-Cubed Code library build.
"""

import sys
from .venv import prepare_local_venv
from .vscode import set_vscode_python_interpreter


def activate_or_build_and_activate_venv(build_tag):
    """
    Activates or builds and activates a virtual environment for the specified build tag.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if successful, False otherwise
    """
    # If local venv is up, then try to activate it via the custom vscode extension
    if prepare_local_venv(build_tag) is not False:
        result = set_vscode_python_interpreter(build_tag)
        return result
    # No venv
    return False


__all__ = ["activate_or_build_and_activate_venv"]

__version__ = "0.1.0"
