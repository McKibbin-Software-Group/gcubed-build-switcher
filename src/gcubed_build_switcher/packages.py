import os
import subprocess

def install_packages(files, python_path, temp_dir_name, gcubed_root, config_param=None):
    """
    Install packages from wheel files or requirements files.

    Args:
        files (list): List of file paths to install
        python_path (str): Path to the Python interpreter in the venv
        temp_dir_name (str): Name of the temporary directory
        gcubed_root (str): Root directory of the G-Cubed project
        config_param (str): Optional config parameter (e.g., '-r' for requirements files)
    """
    if not files:
        return

    file_type = "requirements" if config_param else "wheel"
    print(f"Installing {file_type} files...")

    for file_path in files:
        file_name = os.path.basename(file_path)

        cmd = ["uv", "pip", "install"]

        if config_param is not None:
            cmd.append(config_param)

        cmd.extend([
            "-p", python_path,
            os.path.join(f"./{temp_dir_name}", file_name),
        ])

        subprocess.run(cmd, cwd=gcubed_root, check=True)
