ARG VARIANT=1-3.12
FROM mcr.microsoft.com/devcontainers/python:${VARIANT}

ARG NODE_VERSION="none"
ENV NODE_VERSION=${NODE_VERSION}

ARG TZ
ENV TZ="Australia/Sydney"

# Install uv and node if a version is specified. Note, we're pinning a version
# of uv to ensure the same version is installed in all images. Doing it this way
# lets you manually update uv to verify/test. If everything is working, you can
# update the version here and rebuild the image to update it for everyone.
RUN set -eux; \
    export DEBIAN_FRONTEND=noninteractive; \
    apt-get update; \
    apt-get -y upgrade; \
    apt-get -y install --no-install-recommends \
        tzdata curl ca-certificates; \
    apt-get autoremove -y; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    su vscode -c "curl -LsSf https://astral.sh/uv/0.6.3/install.sh | sh"; \
    if [ "${NODE_VERSION}" != "none" ]; then su vscode -c "umask 0002 && . /usr/local/share/nvm/nvm.sh && nvm install ${NODE_VERSION} 2>&1"; fi;

    # [Optional] Uncomment this section to install additional OS packages.
    # RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    #     && apt-get -y install --no-install-recommends <your-package-list-here>

    # [Optional] Uncomment this line to install global node packages.
    # RUN su vscode -c "source /usr/local/share/nvm/nvm.sh && npm install -g <your-package-here>" 2>&1
