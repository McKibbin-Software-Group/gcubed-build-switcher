ARG PYTHON_VARIANT=3-3.13-bookworm
FROM mcr.microsoft.com/devcontainers/python:${PYTHON_VARIANT}

ARG NODE_VERSION="none"
ENV NODE_VERSION=${NODE_VERSION}

ARG SWITCHER_TEST_MATRIX="0"
ARG VENV_SWITCHER_TAG="latest"
ARG VENV_SWITCHER_PYTHON_TAG
ARG VENV_SWITCHER_PYTHON_URL
ARG VENV_SWITCHER_PYTHON_FILE
ARG VENV_SWITCHER_VSIX_TAG
ARG VENV_SWITCHER_VSIX_URL
ARG VENV_SWITCHER_VSIX_FILE
ARG VENV_SWITCHER_BUNDLE_TAG
ARG VENV_SWITCHER_BUNDLE_URL
ARG VENV_SWITCHER_BUNDLE_FILE

ARG TZ="Australia/Sydney"
ENV TZ=${TZ}

COPY scripts/secure_bundle.py /usr/local/share/gcubed-build-switcher/secure_bundle.py

# Install uv and node if a version is specified. Note, we're pinning a version
# of uv to ensure the same version is installed in all images. Doing it this way
# lets you manually update uv to verify/test. If everything is working, you can
# update the version here and rebuild the image to update it for everyone.
#
# Matrix builds optionally download Python/VSIX artifacts into the same path the
# customer template uses. The onCreate setup script then installs from those
# artifacts instead of the local editable source checkout.
RUN set -eux; \
    export DEBIAN_FRONTEND=noninteractive; \
    apt-get update; \
    apt-get -y install --no-install-recommends \
        tzdata curl ca-certificates; \
    apt-get autoremove -y; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    su vscode -c "curl -LsSf https://astral.sh/uv/0.6.3/install.sh | sh"; \
    if [ "${NODE_VERSION}" != "none" ]; then su vscode -c "umask 0002 && . /usr/local/share/nvm/nvm.sh && nvm install ${NODE_VERSION} 2>&1"; fi; \
    if [ "${SWITCHER_TEST_MATRIX}" = "1" ]; then \
        mkdir -p /home/vscode/extensions/gcubed-venv-switcher; \
        cd /home/vscode/extensions/gcubed-venv-switcher; \
        download_release_asset() { \
            tag="$1"; \
            asset="$2"; \
            destination="$3"; \
            if [ "${tag}" = "latest" ]; then \
                url="https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/latest/download/${asset}"; \
            else \
                url="https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/download/${tag}/${asset}"; \
            fi; \
            echo "Downloading ${url} -> ${destination}"; \
            curl -fL -o "${destination}" "${url}"; \
        }; \
        python_tag="${VENV_SWITCHER_PYTHON_TAG:-${VENV_SWITCHER_TAG:-latest}}"; \
        python_file="${VENV_SWITCHER_PYTHON_FILE:-pyproject.toml}"; \
        if [ -n "${VENV_SWITCHER_PYTHON_URL:-}" ] && [ -z "${VENV_SWITCHER_PYTHON_FILE:-}" ]; then \
            python_file="${VENV_SWITCHER_PYTHON_URL##*/}"; \
        fi; \
        vsix_tag="${VENV_SWITCHER_VSIX_TAG:-${VENV_SWITCHER_TAG:-latest}}"; \
        vsix_file="${VENV_SWITCHER_VSIX_FILE:-gcubed-vscode-venv-switcher.vsix}"; \
        echo "VENV_SWITCHER_TAG = '${VENV_SWITCHER_TAG:-latest}'"; \
        if [ -n "${VENV_SWITCHER_BUNDLE_URL:-}" ] || [ -n "${VENV_SWITCHER_BUNDLE_TAG:-}" ] || [ -n "${VENV_SWITCHER_BUNDLE_FILE:-}" ]; then \
            bundle_tag="${VENV_SWITCHER_BUNDLE_TAG:-latest-secure}"; \
            bundle_file="${VENV_SWITCHER_BUNDLE_FILE:-gcubed-build-switcher-secure.tar.gz}"; \
            echo "VENV_SWITCHER_BUNDLE_TAG = '${bundle_tag}'"; \
            if [ -n "${VENV_SWITCHER_BUNDLE_URL:-}" ]; then \
                echo "Downloading explicit secure bundle ${VENV_SWITCHER_BUNDLE_URL} -> ${bundle_file}"; \
                curl -fL -o "${bundle_file}" "${VENV_SWITCHER_BUNDLE_URL}"; \
            else \
                download_release_asset "${bundle_tag}" "${bundle_file}" "${bundle_file}"; \
            fi; \
            python3 /usr/local/share/gcubed-build-switcher/secure_bundle.py install "${bundle_file}" \
                --artifact-dir /home/vscode/extensions/gcubed-venv-switcher \
                --skip-python-install \
                --sudo never; \
        else \
            echo "VENV_SWITCHER_PYTHON_TAG = '${python_tag}'"; \
            echo "VENV_SWITCHER_VSIX_TAG = '${vsix_tag}'"; \
            if [ -n "${VENV_SWITCHER_PYTHON_URL:-}" ]; then \
                echo "Downloading explicit Python artifact ${VENV_SWITCHER_PYTHON_URL} -> ${python_file}"; \
                curl -fL -o "${python_file}" "${VENV_SWITCHER_PYTHON_URL}"; \
            else \
                download_release_asset "${python_tag}" "${python_file}" "${python_file}"; \
            fi; \
            if [ -n "${VENV_SWITCHER_VSIX_URL:-}" ]; then \
                echo "Downloading explicit VSIX artifact ${VENV_SWITCHER_VSIX_URL} -> gcubed-vscode-venv-switcher.vsix"; \
                curl -fL -o gcubed-vscode-venv-switcher.vsix "${VENV_SWITCHER_VSIX_URL}"; \
            else \
                download_release_asset "${vsix_tag}" "${vsix_file}" gcubed-vscode-venv-switcher.vsix; \
            fi; \
        fi; \
    fi;

    # [Optional] Uncomment this section to install additional OS packages.
    # RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    #     && apt-get -y install --no-install-recommends <your-package-list-here>

    # [Optional] Uncomment this line to install global node packages.
    # RUN su vscode -c "source /usr/local/share/nvm/nvm.sh && npm install -g <your-package-here>" 2>&1
