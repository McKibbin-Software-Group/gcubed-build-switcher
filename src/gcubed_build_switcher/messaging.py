import os
import sys

def format_styled_message(
    message,
    fg_color="yellow",
    bg_color="red",
    border_char="!",
    border_width=3,
    padding=1,
    alignment="center",
):
    """
    Format a message with styling and borders for console output.

    Args:
        message (str or list): The message(s) to display. Can be a single string or a list of strings.
        fg_color (str): Foreground color name (e.g., "yellow", "white").
        bg_color (str): Background color name (e.g., "red", "blue").
        border_char (str): Character used for the border.
        border_width (int): Width of the border on each side.
        padding (int): Number of spaces between border and text content.
        alignment (str): Text alignment - "left", "center", or "right".

    Returns:
        str: The formatted message ready for printing.
    """
    # Handle single string or list of strings
    if isinstance(message, str):
        message = [message]

    # Find max width of the message content
    max_width = max(len(line) for line in message)

    # Add padding to the total width
    padded_width = max_width + (2 * padding)

    # Create borders
    border_line = border_char * (padded_width + 2 * border_width)
    side_border = border_char * border_width
    blank_line = f"{side_border}{' ' * padded_width}{side_border}"

    # Format lines with padding and alignment
    formatted_lines = [border_line, blank_line]
    for line in message:
        if alignment.lower() == "left":
            # Left align: padding on left, remaining space on right
            padded_line = (
                f"{' ' * padding}{line}{' ' * (padded_width - len(line) - padding)}"
            )
        elif alignment.lower() == "right":
            # Right align: remaining space on left, padding on right
            padded_line = (
                f"{' ' * (padded_width - len(line) - padding)}{line}{' ' * padding}"
            )
        else:  # center (default)
            # Split space evenly, with any odd space going to the right
            total_space = padded_width - len(line)
            left_space = total_space // 2
            right_space = total_space - left_space
            padded_line = f"{' ' * left_space}{line}{' ' * right_space}"

        formatted_lines.append(f"{side_border}{padded_line}{side_border}")

    formatted_lines.extend([blank_line, border_line])

    # Check if terminal supports color
    use_color = (
        hasattr(sys.stdout, "isatty")
        and sys.stdout.isatty()
        and os.environ.get("NO_COLOR") is None
    )

    if use_color:
        # Map color names to ANSI color codes
        color_map = {
            "black": 0,
            "red": 1,
            "green": 2,
            "yellow": 3,
            "blue": 4,
            "magenta": 5,
            "cyan": 6,
            "white": 7,
        }

        fg_code = color_map.get(fg_color.lower(), 7)  # Default to white
        bg_code = color_map.get(bg_color.lower(), 0)  # Default to black

        # Apply bold(1) + foreground(30+color) + background(40+color)
        style = f"\033[1;3{fg_code};4{bg_code}m"
        reset = "\033[0m"

        return "\n".join(f"{style}{line}{reset}" for line in formatted_lines)
    else:
        return "\n".join(formatted_lines)


def display_warning(message, **style_kwargs):
    """Display a formatted warning message with default styling."""
    if isinstance(message, str):
        message = [message]

    styled_message = format_styled_message(
        message,
        fg_color=style_kwargs.get("fg_color", "yellow"),
        bg_color=style_kwargs.get("bg_color", "red"),
        border_char=style_kwargs.get("border_char", "!"),
        border_width=style_kwargs.get("border_width", 3),
        padding=style_kwargs.get("padding", 1),
        alignment=style_kwargs.get("alignment", "center")
    )
    print(styled_message)
