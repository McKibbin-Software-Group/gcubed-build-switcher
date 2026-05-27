#!/usr/bin/env bash
set -euo pipefail

workspace_mount="${WORKSPACE_MOUNT:-${PWD}}"
gcubed_root="${GCUBED_ROOT:-${workspace_mount}}"
uv_bin="$(command -v uv)"

enter_directory() {
  cd "$1"
  echo "Changed directory to: ${PWD}"
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

enter_directory "${workspace_mount}"

if [ -f requirements.txt ]; then
  sudo "${uv_bin}" pip install --system -r requirements.txt
fi

if [ -f pyproject.toml ]; then
  sudo "${uv_bin}" pip install --system -e .
fi

if [ -f vscode-extension/package.json ]; then
  enter_directory "${workspace_mount}/vscode-extension"
  npm install
fi

append_bashrc_block
git config --global core.autocrlf input

echo "G-Cubed build switcher devcontainer setup complete"
