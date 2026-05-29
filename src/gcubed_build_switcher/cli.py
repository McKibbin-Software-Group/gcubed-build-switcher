import sys
import argparse
from . import __version__, activate_or_build_and_activate_venv
from .messaging import display_warning
from .version import format_package_version


def main(argv=None):
    """
    Command-line interface for G-Cubed build switcher.
    """
    print(format_package_version(__version__))

    parser = argparse.ArgumentParser(
        description="Activate or build a G-Cubed virtual environment for a specific build tag."
    )
    parser.add_argument(
        "build_tag",
        help="The G-Cubed code build tag to activate"
    )
    args = parser.parse_args(argv)

    if activate_or_build_and_activate_venv(args.build_tag, report_version=False) is False:
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
