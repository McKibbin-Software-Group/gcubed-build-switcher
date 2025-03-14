"""
G-Cubed Build Switcher - Dependency management for G-Cubed economic models.

Different G-Cubed economic models have different dependencies on G-Cubed Code library builds.
Python scripts, which run simulations and create projections based on these models,
are aware of the G-Cubed Code library version required by the model.

This module provides a way to manage the dependencies of G-Cubed model simulations
by creating virtual environments specific to each G-Cubed Code library build.
"""

import sys
from .venv import prepare_local_venv, get_venv_name
from .vscode import set_vscode_python_interpreter
from .config import is_feature_disabled
from .messaging import display_warning


def activate_or_build_and_activate_venv(build_tag):
    """
    Activates or builds and activates a virtual environment for the specified build tag.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if successful, False otherwise
    """

    # Check if build switching is disabled at the entry point
    if is_feature_disabled("AUTO_BUILD_SWITCHER"):
        display_warning(
            "WARNING: Automatic G-Cubed Code build switching disabled. Skipping virtual environment activation."
        )
        return False

    # If local venv is up, then try to activate it via the custom vscode extension
    if prepare_local_venv(build_tag) is not False:
        result = set_vscode_python_interpreter(build_tag)
        if result is False:
            display_warning(
                [
                    "WARNING: Failed to set Python interpreter in VSCode. Please contact G-Cubed support.",
                    "",
                    "NOTE:==>  The virtual environment should still be available in VS Code.",
                    "NOTE:==>  If you do not manually activate it then your models will not run correctly.",
                    "",
                    "To enable the virtual environment manually:",
                    "  * select the command palette ([CTRL/CMD]+[SHIFT]+[P]),",
                    "  * search for 'Python: Select Interpreter'",
                    f"  * and select the environment '{get_venv_name(build_tag)}'.",
                ],
                alignment="left",
            )
        return result
    # No venv

    display_warning(
        [
            "WARNING: Requested virtual environment is not available.",
            "WARNING: This should not happen.",
            "WARNING: Please contact G-Cubed support.",
        ],
        alignment="left",
    )
    return False


__all__ = ["activate_or_build_and_activate_venv"]

__version__ = "0.1.0"
