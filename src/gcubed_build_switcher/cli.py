import sys
import argparse
from . import activate_or_build_and_activate_venv
from .messaging import display_warning

def main():
    """
    Command-line interface for G-Cubed build switcher.
    """
    parser = argparse.ArgumentParser(
        description="Activate or build a G-Cubed virtual environment for a specific build tag."
    )
    parser.add_argument(
        "build_tag",
        help="The G-Cubed code build tag to activate"
    )
    args = parser.parse_args()

    if activate_or_build_and_activate_venv(args.build_tag) is False:
        display_warning(
            [
                "Failed to activate virtual environment required for this simulation. ",
                "Please contact G-Cubed support.",
            ],
            alignment="left",
        )
        sys.exit(1)

    print("\nSuccess. Virtual environment activated.")

if __name__ == "__main__":
    main()
