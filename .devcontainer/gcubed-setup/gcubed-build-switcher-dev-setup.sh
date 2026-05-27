#!/usr/bin/env bash
set -euo pipefail

workspace_mount="${WORKSPACE_MOUNT:-${PWD}}"
gcubed_root="${GCUBED_ROOT:-${workspace_mount}}"
uv_bin="$(command -v uv)"
switcher_artifact_dir="/home/vscode/extensions/gcubed-venv-switcher"

enter_directory() {
  cd "$1"
  echo "Changed directory to: ${PWD}"
}

install_artifact_python_package() {
  if [ ! -d "${switcher_artifact_dir}" ]; then
    return 1
  fi

  enter_directory "${switcher_artifact_dir}"

  shopt -s nullglob
  local switcher_wheels=(./*.whl)
  shopt -u nullglob

  if [ ${#switcher_wheels[@]} -gt 0 ]; then
    echo "Installing G-Cubed build switcher from wheel artifact: ${switcher_wheels[*]}"
    sudo "${uv_bin}" pip install --system "${switcher_wheels[@]}"
    return 0
  fi

  if [ -f pyproject.toml ]; then
    echo "Installing G-Cubed build switcher from release pyproject.toml"
    sudo "${uv_bin}" pip install --system -r pyproject.toml
    return 0
  fi

  return 1
}

install_local_source_package() {
  enter_directory "${workspace_mount}"

  if [ -f requirements.txt ]; then
    sudo "${uv_bin}" pip install --system -r requirements.txt
  fi

  if [ -f pyproject.toml ]; then
    sudo "${uv_bin}" pip install --system -e .
  fi
}

append_bashrc_block() {
  local marker="gcubed-build-switcher-devcontainer"
  local bashrc="${HOME}/.bashrc"

  touch "${bashrc}"
  if grep -qF "# >>> ${marker}" "${bashrc}"; then
    return
  fi

  cat >> "${bashrc}" <<EOF
# >>> ${marker}
alias ll="ls -alhF"
cd() {
  if [ "\$#" -eq 0 ]; then
    command cd "${gcubed_root}"
  else
    command cd "\$@"
  fi
}
export EDITOR="code --wait"
# <<< ${marker}
EOF
}

echo "Setting up G-Cubed build switcher devcontainer"
echo "Workspace mount: ${workspace_mount}"
echo "G-Cubed root: ${gcubed_root}"

if ! install_artifact_python_package; then
  install_local_source_package
fi

if [ -f "${workspace_mount}/vscode-extension/package.json" ]; then
  enter_directory "${workspace_mount}/vscode-extension"
  npm install
fi

append_bashrc_block
git config --global core.autocrlf input

echo "G-Cubed build switcher devcontainer setup complete"
